import React, { useState } from "react";
import { Image as ImageIcon, Clock, Heart, MessageCircle, MoreVertical } from "lucide-react";

function PostComposer({ onPost }) {
  const [text, setText] = useState("");

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onPost({
      id: crypto.randomUUID(),
      author: "",
      level: "Intermediate",
      body: value,
      meeting: "",
      liked: false,
      likes: 0,
      comments: 0,
    });
    setText("");
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What’s on your mind?"
            className="w-full h-11 rounded-xl border border-gray-200 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3 text-gray-500">
              <button className="p-2 hover:bg-gray-100 rounded-lg" title="Attach">
                <ImageIcon />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg" title="Schedule">
                <Clock />
              </button>
            </div>
            <button
              onClick={submit}
              className="px-4 h-10 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 active:scale-95"
            >
              โพสต์
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-xl bg-gray-100 text-gray-700 text-sm px-3 py-1 font-medium">
      {children}
    </span>
  );
}

function PostCard({ post, onToggleLike }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border p-5 ">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{post.author}</h3>
                <span className="h-2 w-24 rounded-full bg-gray-200" />
              </div>
            </div>
            <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <MoreVertical />
            </button>
          </div>

          <p className="mt-3 text-[17px] leading-7 text-gray-900">{post.body}</p>

          <div className="mt-3">{post.level && <Badge>{post.level}</Badge>}</div>

          {post.meeting && <p className="mt-3 text-gray-800 text-[17px]">{post.meeting}</p>}

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4 text-gray-600">
              <button
                onClick={() => onToggleLike(post.id)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 ${
                  post.liked ? "text-rose-600" : ""
                }`}
                aria-label="Like"
              >
                <Heart className={post.liked ? "fill-current" : ""} />
                <span className="text-sm">{post.likes}</span>
              </button>
              <button
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100"
                aria-label="Comment"
              >
                <MessageCircle />
                <span className="text-sm">{post.comments}</span>
              </button>
            </div>

            <button className="px-4 h-10 rounded-xl border text-gray-900 hover:bg-gray-50 font-medium">
              เข้าร่วมกลุ่ม
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MyPost() {
  const [posts, setPosts] = useState([
    // ใส่โพสต์ตัวอย่างได้ เช่น:
    // {
    //   id: "1",
    //   author: "Alex",
    //   level: "Intermediate",
    //   body: "Looking for a physics study group for exam prep.",
    //   meeting: "Meeting Wednesday at 6:00 PM",
    //   liked: false,
    //   likes: 12,
    //   comments: 3,
    // },
  ]);

  const addPost = (p) => setPosts((prev) => [p, ...prev]);

  const toggleLike = (id) =>
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
      )
    );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      {/* ทำให้เต็มหน้า: ไม่มี max-w-*, ใช้ w-full max-w-none */}
      <div className="w-full max-w-none">
        <h1 className="text-2xl font-bold mb-4">โพสต์</h1>

        <PostComposer onPost={addPost} />

        <div className="mt-4 space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onToggleLike={toggleLike} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default MyPost;
