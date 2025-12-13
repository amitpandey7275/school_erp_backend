// ----------------------- IMPORTS ----------------------------
require("dotenv").config();
const multer = require("multer");
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ----------------------- SUPABASE CONNECTION ----------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ ERROR: SUPABASE ENV NOT SET");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ----------------------- MULTER CONFIG ----------------------------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }
});

// ----------------------- REGISTER USER ----------------------------
app.post("/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return res.status(400).json({ error: error.message });

        const userId = data.user.id;

        const { error: dbError } = await supabase
            .from("users")
            .insert([{ id: userId, name, email, role, created_at: Date.now() }]);

        if (dbError) return res.status(500).json({ error: dbError.message });

        res.json({ message: "User Registered Successfully!", userId });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ----------------------- LOGIN ----------------------------
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) return res.status(400).json({ error: error.message });

        res.json({ message: "Login Success", data });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ----------------------- GET ROLE ----------------------------
app.post("/get_role", async (req, res) => {
    try {
        const { id } = req.body;

        const { data, error } = await supabase
            .from("users")
            .select("role")
            .eq("id", id)
            .single();

        if (error) return res.status(400).json({ error: error.message });

        res.json({ role: data.role });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});


// ----------------------- STUDENT PROFILE ----------------------------
app.get("/get_student_profile", async (req, res) => {
    try {
        const uid = req.query.auth_uid;

        const { data, error } = await supabase
            .from("students")
            .select("*")
            .eq("auth_uid", uid)
            .single();

        if (error) return res.json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ----------------------- UPDATE STUDENT PHOTO ----------------------------
app.post("/update_student_photo", upload.single("image"), async (req, res) => {
    try {
        const file = req.file;
        const uid = req.body.auth_uid;

        if (!file) return res.json({ error: "Image is required" });

        const fileName = `students/${Date.now()}-${file.originalname}`;

        const { error: uploadError } = await supabase.storage
            .from("student-photos")
            .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

        if (uploadError) return res.json({ error: uploadError.message });

        const { data: urlData } = supabase.storage
            .from("student-photos")
            .getPublicUrl(fileName);

        const imageUrl = urlData.publicUrl;

        const { error: updateErr } = await supabase
            .from("students")
            .update({ profile_image_url: imageUrl })
            .eq("auth_uid", uid);

        if (updateErr) return res.json({ error: updateErr.message });

        res.json({ success: true, profile_image_url: imageUrl });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});



// ----------------------- TEACHER PROFILE ----------------------------
app.get("/getTeacherProfile", async (req, res) => {
    try {
        const uid = req.query.uid;

        const { data, error } = await supabase
            .from("teachers")
            .select("*")
            .eq("uid", uid)
            .single();

        if (error || !data) return res.json({ success: false, message: "Teacher not found" });

        res.json(data);

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// ----------------------- UPLOAD NOTICE ----------------------------
app.post("/upload_notice", async (req, res) => {
    try {
        const { title, desc } = req.body;

        const { error } = await supabase
            .from("notices")
            .insert([{ title, description: desc, time: Date.now() }]);

        if (error) return res.status(500).json({ error });

        res.json({ message: "Notice Uploaded!" });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ----------------------- GET ALL NOTICES Admin----------------------------
app.get("/get_all_notices", async (req, res) => {

    const { data, error } = await supabase
        .from("notices")
        .select("*")
        .order("time", { ascending: false });

    if (error) return res.status(500).json({ error });

    res.json(data);
});



// ----------------------- GET ALL NOTICES Student----------------------------
app.get("/get_notices", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("notices")
            .select("*")
            .order("time", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});


// ----------------------- GET ALL NOTICES teacher----------------------------
app.get("/getTeacherNotices", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("notices")
            .select("*")
            .order("time", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});







// ----------------------- DELETE NOTICE ----------------------------
app.delete("/delete_notice/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from("notices")
            .delete()
            .eq("id", id);

        if (error) return res.status(500).json({ error });

        res.json({ message: "Notice Deleted!" });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ----------------------- UPDATE NOTICE ----------------------------
app.put("/update_notice/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { title, desc } = req.body;

        const { error } = await supabase
            .from("notices")
            .update({
                title: title,
                description: desc
            })
            .eq("id", id);

        if (error) return res.status(500).json({ error });

        res.json({ message: "Notice Updated!" });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ----------------------- UPLOAD NOTES ----------------------------
app.post("/upload_notes", upload.single("pdf"), async (req, res) => {
    try {
        const { title, cls } = req.body;
        const url = `https://school-erp-zhpk.onrender.com/uploads/${req.file.filename}`;

        const { error } = await supabase
            .from("notes")
            .insert([{ class: cls, title, pdfUrl: url, time: Date.now() }]);

        if (error) return res.status(500).json({ error });

        res.json({ message: "Notes Uploaded!" });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ----------------------- UPLOAD TIME TABLE ROW ----------------------------
app.post("/uploadTimeTable", async (req, res) => {
    try {
        const { class_name, section, day, period_no, subject, teacher_name, time_range } = req.body;

        if (!class_name || !section || !day || !period_no || !subject || !teacher_name || !time_range) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const { error } = await supabase
            .from("time_table")
            .insert([
                {
                    class_name,
                    section,
                    day,
                    period_no,
                    subject,
                    teacher_name,
                    time_range
                }
            ]);

        if (error) return res.status(500).json({ error: error.message });

        res.json({ success: true, message: "Time Table Row Added!" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});


// ----------------------- GET TIME TABLE (VIEW) Admin and all----------------------------

app.get("/getTimeTable", async (req, res) => {
    try {
        const class_name = req.query.class_name?.trim();
        const section = req.query.section?.trim();

        if (!class_name || !section) {
            return res.status(400).json({ error: "class_name and section required" });
        }

        const { data, error } = await supabase
            .from("time_table")
            .select("*")
            .eq("class_name", class_name)
            .eq("section", section)
            .order("day", { ascending: true })
            .order("period_no", { ascending: true });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // ✅ Always return array (empty or filled)
        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});


// =========================================================================
//                          ADMIN GALLERY UPLOAD
// =========================================================================

app.post("/admin_upload_gallery", upload.array("images", 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: "false", message: "Images missing" });
        }

        let uploadedImages = [];

        for (const file of req.files) {
            const fileName = Date.now() + "_" + file.originalname;

            const { error: uploadErr } = await supabase.storage
                .from("gallery")
                .upload(fileName, file.buffer, { contentType: file.mimetype });

            if (uploadErr) {
                return res.status(500).json({ success: "false", message: "Upload error" });
            }

            const { data: urlData } = supabase.storage
                .from("gallery")
                .getPublicUrl(fileName);

            uploadedImages.push({
                imageUrl: urlData.publicUrl,
                fileName: fileName,
                time: Date.now()
            });
        }

        const { error: dbErr } = await supabase
            .from("gallery_images")
            .insert(uploadedImages);

        if (dbErr) {
            return res.status(500).json({ success: "false", message: "DB Insert error" });
        }

        return res.json({ success: "true", images: uploadedImages });

    } catch (err) {
        res.status(500).json({ success: "false", message: "Server error" });
    }
});

// ----------------------- ADMIN GET GALLERY ----------------------------
app.get("/admin_get_gallery", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("gallery_images")
            .select("*")
            .order("time", { ascending: false });

        if (error) return res.status(500).json({ success: "false", message: "DB Fetch error" });

        res.json({ success: "true", images: data });

    } catch (err) {
        res.status(500).json({ success: "false", message: "Server error" });
    }
});



// ----------------------- USER GALLERY (For Students) ----------------------------
app.get("/user_gallery", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("gallery_images")
            .select("*")
            .order("time", { ascending: false });

        if (error) return res.status(500).json({ success: "false", message: error.message });

        res.json({ success: "true", images: data });

    } catch (err) {
        res.status(500).json({ success: "false", message: "Server error" });
    }
});


// ----------------------- ADMIN DELETE GALLERY ----------------------------
app.post("/admin_delete_gallery", async (req, res) => {
    try {
        const { fileName } = req.body;

        if (!fileName) return res.status(400).json({ success: "false", message: "fileName missing" });

        const { error: storageErr } = await supabase.storage
            .from("gallery")
            .remove([fileName]);

        if (storageErr) return res.status(500).json({ success: "false", message: "Storage remove error" });

        const { error: dbErr } = await supabase
            .from("gallery_images")
            .delete()
            .eq("fileName", fileName);

        if (dbErr) return res.status(500).json({ success: "false", message: "DB delete error" });

        res.json({ success: "true", message: "Deleted" });

    } catch (err) {
        res.status(500).json({ success: "false", message: "Server error" });
    }
});


// ----------------------- GET ALL TEACHERS list Admin ----------------------------
app.get("/get_teachers", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("teachers")
            .select("*")
            .order("id", { ascending: true });

        if (error) return res.status(500).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

//                         HOMEWORK SYSTEM
// =========================================================================

app.post("/uploadHomework", async (req, res) => {
    try {
        const { class_name, section, subject, homework_text, teacher_id } = req.body;

        if (!class_name || !section || !subject || !homework_text || !teacher_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const { data, error } = await supabase
            .from("homework")
            .insert([{
                class_name,
                section,
                subject,
                homework_text,
                teacher_id,
                date: new Date().toISOString().split("T")[0]
            }]);

        if (error) return res.status(400).json({ error: error.message });

        res.json({ success: true, message: "Homework uploaded", data });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------------- GET TEACHER HOMEWORK ----------------------------
app.get("/getTeacherHomeworks", async (req, res) => {
    try {
        const { teacher_id, class_name, section } = req.query;

        const { data, error } = await supabase
            .from("homework")
            .select("*")
            .eq("teacher_id", teacher_id)
            .eq("class_name", class_name)
            .eq("section", section)
            .order("id", { ascending: false });

        if (error) return res.status(500).json({ message: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// =========================================================================
//                         CLASSWORK UPLOAD
// =========================================================================

app.post("/uploadClasswork", upload.single("file"), async (req, res) => {
    try {
        const { title, description, class_name, section_name, subject } = req.body;

        let fileUrl = null;

        if (req.file) {
            const fileName = "classwork/" + Date.now() + "_" + req.file.originalname;

            const { error: uploadErr } = await supabase.storage
                .from("classwork")
                .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

            if (uploadErr) return res.status(500).json({ error: "File upload failed" });

            const { data: urlData } = supabase.storage
                .from("classwork")
                .getPublicUrl(fileName);

            fileUrl = urlData.publicUrl;
        }

        const { error } = await supabase
            .from("classwork")
            .insert([{
                title,
                description,
                class_name,
                section_name,
                subject,
                file_url: fileUrl,
                created_at: new Date()
            }]);

        if (error) return res.status(500).json({ error: error.message });

        res.json({
            success: true,
            message: "Classwork Uploaded Successfully",
            fileUrl
        });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ----------------------- GET CLASSWORK ----------------------------
app.get("/getClasswork", async (req, res) => {
    try {
        const { class: className, section } = req.query;

        const { data, error } = await supabase
            .from("classwork")
            .select("*")
            .eq("class_name", className)
            .eq("section_name", section)
            .order("created_at", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// =========================================================================
//                         TEACHER NOTES
// =========================================================================

app.post("/teacherUploadNotes", async (req, res) => {
    try {
        const { class_name, subject, title, pdf_url, teacher_id } = req.body;

        const { data, error } = await supabase
            .from("TeacherUploadNotes")
            .insert([{ class_name, subject, title, pdf_url, teacher_id }]);

        if (error) return res.status(500).json({ error: error.message });

        res.json({ message: "Notes Uploaded Successfully", data });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------------- GET TEACHER NOTES ----------------------------
app.get("/getTeacherUploadNotes", async (req, res) => {
    try {
        const { teacher_id } = req.query;

        let query = supabase
            .from("TeacherUploadNotes")
            .select("*")
            .order("created_at", { ascending: false });

        if (teacher_id) query = query.eq("teacher_id", teacher_id);

        const { data, error } = await query;

        if (error) return res.status(500).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =========================================================================
//                         GET STUDENTS
// =========================================================================

app.get("/getStudents", async (req, res) => {
  try {
    const { class_name, section } = req.query;

    let query = supabase
      .from("students")
      .select("*")
      .order("class_name", { ascending: true })
      .order("section", { ascending: true })
      .order("roll_no", { ascending: true });

    if (class_name && class_name !== "ALL") {
      query = query.eq("class_name", class_name);
    }

    if (section && section !== "ALL") {
      query = query.eq("section", section);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// =========================================================================
//                         TEACHER ATTENDANCE
// =========================================================================

app.get("/getTeacherAttendanceCalendar", async (req, res) => {
    try {
        const { uid } = req.query;

        if (!uid) return res.status(400).json({ error: "UID required" });

        const { data, error } = await supabase
            .from("teacher_attendance")
            .select("*")
            .eq("teacher_uid", uid);

        if (error) return res.status(500).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ----------------------- MARK TEACHER ATTENDANCE (ADMIN) ----------------------------
app.post("/markTeacherAttendance", async (req, res) => {
    try {
        const { teacher_uid, status, date } = req.body;

        if (!teacher_uid || !status || !date) {
            return res.status(400).json({ error: "Missing teacher_uid, status or date" });
        }

        // Check if already marked for selected date
        const { data: existing, error: checkError } = await supabase
            .from("teacher_attendance")
            .select("*")
            .eq("teacher_uid", teacher_uid)
            .eq("date", date)
            .maybeSingle();

        if (existing) {
            // Update existing attendance
            const { error: updateErr } = await supabase
                .from("teacher_attendance")
                .update({ status })
                .eq("teacher_uid", teacher_uid)
                .eq("date", date);

            if (updateErr) return res.status(500).json({ error: updateErr.message });

            return res.json({ success: true, message: "Attendance updated!" });
        }

        // Insert new record
        const { error } = await supabase
            .from("teacher_attendance")
            .insert([{ teacher_uid, date, status }]);

        if (error) return res.status(500).json({ error });

        res.json({ success: true, message: "Attendance marked!" });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});


// =========================================================================
//                         ADMIN PROFILE
// =========================================================================

app.get("/getAdmin", async (req, res) => {
    try {
        const { email } = req.query;

        const { data, error } = await supabase
            .from("admins")
            .select("*")
            .eq("email", email)
            .single();

        if (error) return res.status(500).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/updateAdminProfile", upload.single("image"), async (req, res) => {
    try {
        const { name, phone, email } = req.body;

        let imageUrl = null;

        if (req.file) {
            const ext = req.file.originalname.split(".").pop();
            const fileName = `admin_${Date.now()}.${ext}`;

            await supabase.storage
                .from("admin_images")
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype
                });

            const { data: urlData } = supabase.storage
                .from("admin_images")
                .getPublicUrl(fileName);

            imageUrl = urlData.publicUrl;
        }

        const { error } = await supabase
            .from("admins")
            .update({
                name,
                phone,
                ...(imageUrl && { image: imageUrl })
            })
            .eq("email", email);

        if (error) return res.status(500).json({ error: error.message });

        res.json({ success: true, message: "Profile updated!" });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// =========================================================================
//                         SERVER START
// =========================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});









