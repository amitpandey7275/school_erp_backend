// ----------------------- IMPORTS ----------------------------
const express = require("express");
const multer = require("multer");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const app = express();

app.use(express.json());
app.use("/uploads", express.static("uploads"));   // Image/PDF folder

// ----------------------- SUPABASE CONNECTION ----------------------------
const supabase = createClient(
    "https://nkgkptxqsrogaiexfuvt.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rZ2twdHhxc3JvZ2FpZXhmdXZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTMxNzEsImV4cCI6MjA3OTI4OTE3MX0.9x2JU_AEApbIYS4477rhk9IhJ-MO-zCMylHFIoqpnXo"
);

// ----------------------- MULTER CONFIG ----------------------------
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ----------------------- SIGNUP (Auth + USERS TABLE) ----------------------------
app.post("/register", async (req, res) => {
    const { name, email, password, role } = req.body;

    // 1. Create Supabase auth user
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    const userId = data.user.id;

    // 2. Insert into "users" table
    const { error: dbError } = await supabase
        .from("users")
        .insert([
            {
                id: userId,
                name: name,
                email: email,
                role: role,
                created_at: Date.now()
            }
        ]);

    if (dbError) return res.status(500).json({ error: dbError.message });

    res.json({ message: "User Registered Successfully!", userId });
});

// ----------------------- LOGIN (Supabase Auth) ----------------------------
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Login Success", data });
});

// ----------------------- GET ROLE API ----------------------------
app.post("/get_role", async (req, res) => {
    const { id } = req.body;

    const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", id)
        .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json({ role: data.role });
});

// ----------------------- UPLOAD EVENT ----------------------------
app.post("/upload_event", upload.single("image"), async (req, res) => {
    const { title, desc } = req.body;

    if (!req.file) return res.status(400).json({ error: "Image missing" });

    const imageUrl = `http://172.168.26.158:3000/uploads/${req.file.filename}`;

    const { error } = await supabase
        .from("events")
        .insert([{ title, description: desc, image: imageUrl, time: Date.now() }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Event Uploaded!" });
});

// ----------------------- UPLOAD NOTICE ----------------------------
app.post("/upload_notice", async (req, res) => {
    const { title, desc } = req.body;

    const { error } = await supabase
        .from("notices")
        .insert([{ title, description: desc, time: Date.now() }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Notice Uploaded!" });
});

// ----------------------- ADD STUDENT ----------------------------
app.post("/add_student", async (req, res) => {
    const { name, email, phone, cls, pass } = req.body;

    const { error } = await supabase
        .from("students")
        .insert([{ name, email, phone, class: cls, password: pass }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Student Added!" });
});

// ----------------------- ADD TEACHER ----------------------------
app.post("/add_teacher", async (req, res) => {
    const { name, email, phone, pass } = req.body;

    const { error } = await supabase
        .from("teachers")
        .insert([{ name, email, phone, password: pass, createdAt: Date.now() }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Teacher Added!" });
});

// ----------------------- GET TEACHERS ----------------------------
app.get("/get_teachers", async (req, res) => {
    const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .order("name", { ascending: true });

    if (error) return res.status(500).json({ error });

    res.json(data);
});

// ----------------------- DELETE TEACHER ----------------------------
app.post("/delete_teacher", async (req, res) => {
    const { id } = req.body;

    const { error } = await supabase
        .from("teachers")
        .delete()
        .eq("id", id);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Teacher Deleted" });
});

// ----------------------- TEACHER ATTENDANCE ----------------------------
app.post("/submit_teacher_attendance", async (req, res) => {
    const { attendance, time } = req.body;

    const { error } = await supabase
        .from("teacher_attendance")
        .insert([{ time, data: JSON.stringify(attendance) }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Attendance Saved" });
});

// ----------------------- UPLOAD EXAM ----------------------------
app.post("/upload_exam", async (req, res) => {
    const { cls, subj, title, date, desc } = req.body;

    const { error } = await supabase
        .from("exams")
        .insert([{ class: cls, subject: subj, title, date, description: desc, time: Date.now() }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Exam Uploaded!" });
});

// ----------------------- GALLERY UPLOAD ----------------------------
app.post("/upload_gallery", upload.array("images", 10), async (req, res) => {
    if (!req.files) return res.status(400).json({ error: "Images missing" });

    let values = req.files.map(f => ({
        imageUrl: `http://172.168.26.158:3000/uploads/${f.filename}`,
        time: Date.now()
    }));

    const { error } = await supabase.from("gallery").insert(values);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Gallery Uploaded!" });
});

// ----------------------- UPLOAD NOTES ----------------------------
app.post("/upload_notes", upload.single("pdf"), async (req, res) => {
    const { title, cls } = req.body;

    const pdfUrl = `http://172.168.26.158:3000/uploads/${req.file.filename}`;

    const { error } = await supabase
        .from("notes")
        .insert([{ class: cls, title, pdfUrl, time: Date.now() }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "Notes Uploaded!" });
});

// ----------------------- UPLOAD TIMETABLE ----------------------------
app.post("/upload_timetable", upload.single("pdf"), async (req, res) => {
    const { cls } = req.body;

    const pdfUrl = `http://172.168.26.158:3000/uploads/${req.file.filename}`;

    const { error } = await supabase
        .from("timetable")
        .insert([{ class: cls, pdfUrl, time: Date.now() }]);

    if (error) return res.status(500).json({ error });

    res.json({ message: "TimeTable Uploaded!" });
});

// ----------------------- GET NOTICES ----------------------------
app.get("/get_notices", async (req, res) => {
    const { data, error } = await supabase
        .from("notices")
        .select("*")
        .order("time", { ascending: false });

    if (error) return res.status(500).json({ error });

    res.json(data);
});

// ----------------------- START SERVER ----------------------------
app.listen(3000, "0.0.0.0", () => {
    console.log("Server running on port 3000");
});
