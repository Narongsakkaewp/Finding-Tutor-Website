const DEFAULT_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const DEFAULT_BATCH_SIZE = 32;
const MAX_CACHE_ENTRIES = 5000;

// ไฟล์นี้เป็นส่วน semantic embedding ของ Recommendation System
//
// แนวคิดหลัก:
// 1. รับข้อความ เช่น วิชาที่นักเรียนสนใจ, subject ของโพสต์, can_teach_subjects ของติวเตอร์
// 2. แปลงข้อความเป็น embedding vector ด้วยโมเดล multilingual sentence embedding
// 3. วัดความใกล้เคียงของ vector ด้วย cosine similarity
// 4. ส่ง similarity กลับไปให้ discoveryEngine แปลงเป็นคะแนน 0-100
//
// จุดสำคัญ:
// - ระบบนี้เป็น text-to-embedding ไม่ใช่ synonyms matching
// - ไม่ได้เติมคำเหมือน/คำแทนเอง แต่ให้โมเดลเข้าใจความหมายของข้อความ
// - ใช้ multilingual model เพื่อรองรับทั้งภาษาไทยและอังกฤษ เช่น "แคลคูลัส", "calculus", "คณิตมหาวิทยาลัย"
// - มี cache เพื่อลดการคำนวณซ้ำ เพราะข้อความเดิมควรได้ embedding เดิม
const vectorCache = new Map();
let extractorPromise = null;
let disabledAfterError = false;
const thaiWordSegmenter = new Intl.Segmenter('th', { granularity: 'word' });

function isEnabled() {
  return String(process.env.RECOMMENDATION_EMBEDDINGS_ENABLED ?? 'true').toLowerCase() !== 'false';
}

function normalizeEmbeddingText(value) {
  // ทำความสะอาดข้อความก่อนส่งเข้าโมเดล embedding
  // มีการตัดคำภาษาไทยด้วย Intl.Segmenter เพื่อช่วยให้โมเดลเห็นขอบเขตคำชัดขึ้น
  // และจำกัดความยาวไม่เกิน 1200 ตัวอักษร เพื่อไม่ให้ข้อความยาวเกินจำเป็น
  const cleaned = String(value || '')
    .replace(
      /(อยาก(?:จะ)?เรียน|ต้องการ(?:หา)?(?:คน)?(?:มา)?ติว|ต้องการเรียน|หาติวเตอร์|หาเพื่อนติว|ช่วยสอน|รับสอน)/g,
      ' '
    )
    .trim();
  const segmented = Array.from(thaiWordSegmenter.segment(cleaned))
    .map((item) => (item.isWordLike ? ` ${item.segment} ` : item.segment))
    .join('');

  return segmented
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

function getCacheKey(kind, text) {
  const model = process.env.RECOMMENDATION_EMBEDDING_MODEL || DEFAULT_MODEL;
  return `${model}:${kind}:${normalizeEmbeddingText(text).toLowerCase()}`;
}

function formatModelInput(kind, text) {
  const model = process.env.RECOMMENDATION_EMBEDDING_MODEL || DEFAULT_MODEL;
  return model.toLowerCase().includes('e5') ? `${kind}: ${text}` : text;
}

function rememberVector(key, vector) {
  if (vectorCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = vectorCache.keys().next().value;
    if (oldestKey) vectorCache.delete(oldestKey);
  }
  vectorCache.set(key, vector);
}

async function getExtractor() {
  if (!isEnabled() || disabledAfterError) return null;

  if (!extractorPromise) {
    // โหลดโมเดล feature-extraction จาก @huggingface/transformers
    // โมเดลเริ่มต้นคือ Xenova/paraphrase-multilingual-MiniLM-L12-v2
    // dtype q8 คือ quantized model ช่วยให้เบาและรันบนเครื่อง local ได้ง่ายขึ้น
    extractorPromise = import('@huggingface/transformers')
      .then(({ pipeline, env }) => {
        env.allowLocalModels = true;
        env.useBrowserCache = false;
        return pipeline(
          'feature-extraction',
          process.env.RECOMMENDATION_EMBEDDING_MODEL || DEFAULT_MODEL,
          { dtype: process.env.RECOMMENDATION_EMBEDDING_DTYPE || 'q8' }
        );
      })
      .catch((error) => {
        disabledAfterError = true;
        extractorPromise = null;
        console.warn(`Semantic embeddings unavailable; semantic matching is disabled: ${error.message}`);
        return null;
      });
  }

  return extractorPromise;
}

async function embedTexts(texts, kind = 'passage') {
  // แปลง array ของข้อความเป็น array ของ embedding vectors
  // kind='query' ใช้กับข้อความฝั่งผู้ใช้/คำค้น
  // kind='passage' ใช้กับข้อความฝั่งโพสต์/โปรไฟล์ที่ถูกนำมาเปรียบเทียบ
  //
  // ขั้นตอนนี้จะ:
  // - normalize ข้อความ
  // - เช็ก cache ก่อน
  // - รวมข้อความซ้ำให้คำนวณครั้งเดียว
  // - batch ข้อความเข้าโมเดลเพื่อลดเวลา
  const normalizedTexts = texts.map(normalizeEmbeddingText);
  const results = new Array(normalizedTexts.length).fill(null);
  const missingByKey = new Map();

  normalizedTexts.forEach((text, index) => {
    if (!text) return;
    const key = getCacheKey(kind, text);
    const cached = vectorCache.get(key);
    if (cached) {
      results[index] = cached;
    } else {
      const pending = missingByKey.get(key);
      if (pending) {
        pending.indexes.push(index);
      } else {
        missingByKey.set(key, {
          indexes: [index],
          key,
          text: formatModelInput(kind, text),
        });
      }
    }
  });

  const missing = Array.from(missingByKey.values());
  if (!missing.length) return results;

  const extractor = await getExtractor();
  if (!extractor) return results;

  const batchSize = Math.max(
    1,
    Number(process.env.RECOMMENDATION_EMBEDDING_BATCH_SIZE || DEFAULT_BATCH_SIZE)
  );

  for (let offset = 0; offset < missing.length; offset += batchSize) {
    const batch = missing.slice(offset, offset + batchSize);
    try {
      const output = await extractor(batch.map((item) => item.text), {
        // mean pooling คือรวม token embeddings ทั้งประโยคออกมาเป็น vector เดียว
        // normalize=true ทำให้ vector พร้อมใช้กับ cosine similarity และเปรียบเทียบกันได้เสถียรขึ้น
        pooling: 'mean',
        normalize: true,
      });
      const vectors = output.tolist();
      batch.forEach((item, batchIndex) => {
        const vector = vectors[batchIndex];
        if (!Array.isArray(vector)) return;
        rememberVector(item.key, vector);
        item.indexes.forEach((index) => {
          results[index] = vector;
        });
      });
    } catch (error) {
      console.warn(`Semantic embedding batch failed; semantic matching is disabled: ${error.message}`);
      break;
    }
  }

  return results;
}

function cosineSimilarity(left, right) {
  // cosine similarity ใช้วัดมุม/ทิศทางของ vector
  // ค่ายิ่งสูง แปลว่าข้อความสองฝั่งมีความหมายใกล้กันมากขึ้น
  // ตัวอย่าง: "แคลคูลัส" กับ "คณิตศาสตร์มหาวิทยาลัย" ควรมี similarity สูงกว่า "แคลคูลัส" กับ "ดนตรี"
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return null;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (!leftNorm || !rightNorm) return null;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function scoreTextVariants(queryText, rows, variantBuilders) {
  // ใช้เมื่อมี query หนึ่งชุด แล้วต้องการให้คะแนนหลาย candidate rows
  // เช่น query = ข้อความจากโปรไฟล์นักเรียน
  // rows = โพสต์ติวเตอร์ทั้งหมดที่ดึงมาเป็น candidate
  // variantBuilders = วิธีสร้างข้อความหลายแบบจาก row เช่น subject อย่างเดียว หรือ can_teach_subjects + subject
  //
  // ผลลัพธ์คือ rows เดิมที่ถูกเติม field similarity เช่น semantic_subject_similarity
  const cleanQuery = normalizeEmbeddingText(queryText);
  if (!cleanQuery || !rows.length || !variantBuilders.length) return rows;

  const [queryVector] = await embedTexts([cleanQuery], 'query');
  if (!queryVector) return rows;

  const flattened = [];
  rows.forEach((row, rowIndex) => {
    variantBuilders.forEach(({ key, buildText }) => {
      flattened.push({
        rowIndex,
        key,
        text: normalizeEmbeddingText(buildText(row)),
      });
    });
  });

  const passageVectors = await embedTexts(flattened.map((item) => item.text), 'passage');
  const enriched = rows.map((row) => ({ ...row }));

  flattened.forEach((item, index) => {
    const similarity = cosineSimilarity(queryVector, passageVectors[index]);
    if (similarity !== null) enriched[item.rowIndex][item.key] = Number(similarity.toFixed(6));
  });

  return enriched;
}

function semanticSimilarityToPercent(similarity) {
  // แปลง cosine similarity เป็นคะแนน 0-100 เพื่อให้เอาไปใช้ในสูตร Recommendation ได้ง่าย
  //
  // ค่าเริ่มต้น:
  // - similarity <= 0.18 ถือว่าไม่เกี่ยวข้องพอ ได้ 0
  // - similarity >= 0.42 ถือว่าเกี่ยวข้องมาก ได้ 100
  // - ค่าระหว่างนั้นจะไล่คะแนนแบบ linear
  //
  // เหตุผลที่ไม่ใช้ similarity ตรง ๆ:
  // cosine similarity ของ sentence embedding มักไม่ได้กระจายตั้งแต่ 0 ถึง 1 แบบคะแนนทั่วไป
  // จึง normalize ช่วงที่ใช้งานจริงให้เป็นเปอร์เซ็นต์เพื่ออธิบายและคำนวณต่อได้ง่ายขึ้น
  if (!Number.isFinite(Number(similarity))) return null;

  const minimum = Number(process.env.RECOMMENDATION_SEMANTIC_MIN_SIMILARITY || 0.18);
  const strong = Number(process.env.RECOMMENDATION_SEMANTIC_STRONG_SIMILARITY || 0.42);
  const value = Number(similarity);
  if (value <= minimum) return 0;
  if (value >= strong) return 100;
  return Number((((value - minimum) / (strong - minimum)) * 100).toFixed(2));
}

module.exports = {
  scoreTextVariants,
  semanticSimilarityToPercent,
};
