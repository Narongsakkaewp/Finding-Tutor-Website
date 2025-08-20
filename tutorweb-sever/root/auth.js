// routes/auth.js
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ success: false, message: 'ไม่พบผู้ใช้' });

  const ok = await user.comparePassword(password); // แล้วแต่ที่คุณทำ
  if (!ok) return res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });

  // สมมติ user.role เก็บ 'student' หรือ 'tutor'
  // (ถ้าใช้คำว่า 'teacher' ให้ map เป็น 'tutor')
  const userType = (user.role || '').toLowerCase() === 'teacher' ? 'tutor' : user.role;

  return res.json({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: userType,            // ใส่ใน user.role ก็ได้
    },
    userType: userType,          // และใส่ซ้ำที่ root ให้ frontend อ่านง่าย
    // token: jwt.sign(...)       // ถ้ามี
  });
});
