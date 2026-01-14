require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");

const app = express();

/* ===== SIMPLE CORS (TESTING MODE) ===== */
app.use(cors({
  origin: "*",   // 🔥 sab allow (local testing ke liye)
}));

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
// ----------------------- GET ROLE ----------------------------
app.post("/get_role", async (req, res) => {
    try {
        const { auth_id } = req.body;   // ✅ auth_id lo

        if (!auth_id) {
            return res.status(400).json({ error: "auth_id required" });
        }

        const { data, error } = await supabase
            .from("users")
            .select("role")
            .eq("auth_id", auth_id)
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ role: data.role });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});


// ----------------------- STUDENT PROFILE ----------------------------
app.get("/api/student/profile/:auth_id", async (req, res) => {
  try {
    const { auth_id } = req.params;

    // 1️⃣ STUDENT BASIC DATA
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("*")
      .eq("auth_id", auth_id)
      .single();

    if (studentError || !student) {
      console.error("STUDENT ERROR:", studentError);
      return res.status(404).json({ error: "Student not found" });
    }

    // 2️⃣ USER DATA
    const { data: user } = await supabase
      .from("users")
      .select("name, email")
      .eq("auth_id", auth_id)
      .single();

    // 3️⃣ CLASS
    const { data: classData } = await supabase
      .from("classes")
      .select("class_name")
      .eq("class_id", student.class_id)
      .single();

    // 4️⃣ SECTION
    const { data: sectionData } = await supabase
      .from("sections")
      .select("section_name")
      .eq("section_id", student.section_id)
      .single();

    // 5️⃣ MERGE RESPONSE
    res.json({
      ...student,
      users: user || {},
      classes: classData || {},
      sections: sectionData || {}
    });

  } catch (err) {
    console.error("PROFILE API CRASH:", err);
    res.status(500).json({ error: "Profile fetch failed" });
  }
});




 //-------------------fee student-------------------------

app.get("/api/student/fees/:auth_id", async (req, res) => {
  const { auth_id } = req.params;

  const { data, error } = await supabase
    .from("student_fees")
    .select("fee_type, fee_name, month, amount, status")
    .eq("auth_id", auth_id)
    .order("month", { ascending: true });

  if (error) return res.status(400).json({ error });

  res.json(data);
});



//-------------------result------------

app.get("/api/student/result", async (req, res) => {
  try {
    const { student_id, exam_type } = req.query;

    const { data, error } = await supabase
      .from("results")
      .select("*")
      .eq("student_id", student_id)
      .eq("exam_type", exam_type);

    if (error) return res.status(500).json({ error });

    res.json(data);
  } catch {
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


// ===========================Adin Photo==============================================

// ======================= GET ADMIN PROFILE =======================
app.get("/getAdmin", async (req, res) => {
    try {
        const email = req.query.email?.trim();

        if (!email) {
            return res.status(400).json({ error: "Email required" });
        }

        const { data, error } = await supabase
            .from("admins")
            .select("name, email, phone, qualification, address, role, image")
            .eq("email", email)
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ======================= UPDATE ADMIN PROFILE PHOTO =======================
app.post(
    "/updateAdminProfileImage",
    upload.single("image"),
    async (req, res) => {

        try {
            const email = req.body.email;

            if (!email || !req.file) {
                return res.status(400).json({
                    error: "Email and image required"
                });
            }

            // ✅ SAFE filename (FIXED)
            const ext = req.file.originalname.split(".").pop();
            const fileName = `admin_${Date.now()}.${ext}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from("admin_images")
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: true
                });

            if (uploadError) {
                return res.status(500).json({ error: uploadError.message });
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from("admin_images")
                .getPublicUrl(fileName);

            const imageUrl = urlData.publicUrl;

            // Update DB
            const { error } = await supabase
                .from("admins")
                .update({ image: imageUrl })
                .eq("email", email);

            if (error) {
                return res.status(500).json({ error: error.message });
            }

            res.json({
                success: true,
                message: "Profile photo updated",
                image: imageUrl
            });

        } catch (err) {
            res.status(500).json({ error: "Server error" });
        }
    }
);
// ----------------------- TEACHER PROFILE ----------------------------
app.get("/getTeacherProfile", async (req, res) => {
    try {
        const uid = req.query.uid;

        if (!uid) {
            return res.status(400).json({ message: "UID required" });
        }

        const { data, error } = await supabase
            .from("teachers")
            .select(`
                id,
                uid,
                name,
                email,
                phone,
                qualification,
                subject,
                experience,
                profile_image_url
            `)
            .eq("uid", uid)
            .single();

        if (error || !data) {
            return res.status(404).json({ message: "Teacher not found" });
        }

        res.json(data);

    } catch (err) {
        res.status(500).json({ message: err.message });
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

// ----------------------- TEACHER UPLOAD NOTES ----------------------------
// ======================= UPLOAD TEACHER NOTES =======================
app.post("/uploadTeacherNotes", async (req, res) => {
    try {
        const { class_name, subject, title, teacher_id, pdf_url } = req.body;

        if (!class_name || !subject || !title || !teacher_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const { data, error } = await supabase
            .from("teacher_notes")
            .insert([{
                class_name,
                subject,
                title,
                teacher_id,
                pdf_url: pdf_url || "",
                date: new Date().toISOString().split("T")[0]
            }]);

        if (error) return res.status(400).json({ error: error.message });

        res.json({
            success: true,
            message: "Notes uploaded",
            data
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ================= UPLOAD TEACHER NOTES =================
app.post("/uploadTeacherNotes", upload.single("pdf"), async (req, res) => {
  try {
    const { teacher_id, class_name, subject, title } = req.body;

    if (!teacher_id || !class_name || !subject || !title) {
      return res.status(400).json({ error: "Missing fields" });
    }

    let pdfUrl = null;

    if (req.file) {
      const fileName = `notes/${Date.now()}_${req.file.originalname}`;

      const { error: uploadErr } = await supabase.storage
        .from("teacher_notes")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype
        });

      if (uploadErr) return res.status(500).json({ error: uploadErr.message });

      const { data } = supabase.storage
        .from("teacher_notes")
        .getPublicUrl(fileName);

      pdfUrl = data.publicUrl;
    }

    const { error } = await supabase
      .from("teacher_notes")
      .insert([{
        teacher_id,
        class_name,
        subject,
        title,
        pdf_url: pdfUrl
      }]);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ================= GET TEACHER NOTES =================
app.get("/getTeacherNotes", async (req, res) => {
  const { teacher_id, class_name, subject } = req.query;

  const { data, error } = await supabase
    .from("teacher_notes")
    .select("*")
    .eq("teacher_id", teacher_id)
    .eq("class_name", class_name)
    .eq("subject", subject)
    .order("id", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});


// ================= DELETE NOTES =================
app.delete("/deleteTeacherNotes/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("teacher_notes")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});


// ================= UPDATE NOTES =================
app.put("/updateTeacherNotes/:id", async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  const { error } = await supabase
    .from("teacher_notes")
    .update({ title })
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ----------------------- UPLOAD TIME TABLE ROW ----------------------------
app.post("/uploadTimeTable", async (req, res) => {
    try {
        let {
            class_name,
            section,
            day,
            period_no,
            subject,
            teacher_name,
            time_range
        } = req.body;

        // safety trim
        class_name = class_name?.trim();
        section = section?.trim();
        day = day?.trim();
        subject = subject?.trim();
        teacher_name = teacher_name?.trim();
        time_range = time_range?.trim();

        if (!class_name || !section || !day || !period_no ||
            !subject || !teacher_name || !time_range) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const { error } = await supabase
            .from("time_table")
            .insert([{
                class_name,          // Class 1
                section,             // Section A
                day,
                period_no: parseInt(period_no),
                subject,
                teacher_name,
                time_range
            }]);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, message: "Time Table Row Added!" });

    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ----------------------- GET TIME TABLE (Admin / Student / Teacher) ----------------------------
app.get("/getTimeTable", async (req, res) => {
    try {
        const class_name = req.query.class_name?.trim();
        const section = req.query.section?.trim();
        const day = req.query.day?.trim();

        if (!class_name || !section || !day) {
            return res.status(400).json({ error: "class_name, section and day required" });
        }

        const { data, error } = await supabase
            .from("time_table")
            .select("*")
            .eq("class_name", class_name)
            .eq("section", section)
            .eq("day", day)
            .order("period_no", { ascending: true });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

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

//                         Teacher UPLOAD HOMEWORK 
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
        const { teacher_id, class_name, section, subject } = req.query;

        if (!teacher_id || !class_name || !section || !subject) {
            return res.status(400).json({ error: "Missing query params" });
        }

        const { data, error } = await supabase
            .from("homework")
            .select("*")
            .eq("teacher_id", teacher_id)
            .eq("class_name", class_name)
            .eq("section", section)
            .eq("subject", subject)
            .order("id", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------DELETE HOMEWORK--------------
app.delete("/deleteHomework/:id", async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from("homework")
        .delete()
        .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
});

//------------- UPDATE HOMEWORK--------------
app.put("/updateHomework/:id", async (req, res) => {
    const { id } = req.params;
    const { homework_text } = req.body;

    const { error } = await supabase
        .from("homework")
        .update({ homework_text })
        .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
});

// =========================================================================
//                         CLASSWORK UPLOAD
app.post("/uploadClasswork", upload.single("file"), async (req, res) => {
    try {
        const { title, description, class_name, section_name, subject } = req.body;

        let fileUrl = null;

        if (req.file) {
            const fileName = "classwork/" + Date.now() + "_" + req.file.originalname;

            const { error: uploadErr } = await supabase.storage
                .from("classwork")
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype
                });

            if (uploadErr) return res.status(500).json({ error: uploadErr.message });

            const { data } = supabase.storage
                .from("classwork")
                .getPublicUrl(fileName);

            fileUrl = data.publicUrl;
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

        res.json({ success: true });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =====================get Classwork ====================================================
app.get("/getClasswork", async (req, res) => {
    try {
        const { class: className, section, subject } = req.query;

        const { data, error } = await supabase
            .from("classwork")
            .select("*")
            .eq("class_name", className)
            .eq("section_name", section)
            .eq("subject", subject)
            .order("created_at", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        res.json(data);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ==========================edit classwork===============================================
app.put("/updateClasswork/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;

        const { error } = await supabase
            .from("classwork")
            .update({
                title,
                description
            })
            .eq("id", id);

        if (error) return res.status(500).json({ error: error.message });

        res.json({ success: true, message: "Classwork updated" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================================deleet cw=======================================
app.delete("/deleteClasswork/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from("classwork")
            .delete()
            .eq("id", id);

        if (error) return res.status(500).json({ error: error.message });

        res.json({ success: true, message: "Classwork deleted" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//                         TEACHER NOTES
// =========================================================================
// ================= UPLOAD TEACHER NOTES =================
app.post(
  "/uploadTeacherNotes",
  upload.single("pdf"),
  async (req, res) => {

    try {
      const { teacher_id, class_name, subject, title } = req.body;

      if (!teacher_id || !class_name || !subject || !title) {
        return res.status(400).json({ error: "Missing fields" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "PDF not received" });
      }

      // 🔹 Upload to Supabase Storage
      const fileName =
        "notes/" + Date.now() + "_" + req.file.originalname;

      const { error: uploadErr } =
        await supabase.storage
          .from("teacher_notes")
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype
          });

      if (uploadErr) {
        console.log("STORAGE ERROR:", uploadErr);
        return res.status(500).json({ error: uploadErr.message });
      }

      const { data: urlData } =
        supabase.storage
          .from("teacher_notes")
          .getPublicUrl(fileName);

      const pdfUrl = urlData.publicUrl;

      // 🔹 Insert into DB
      const { error: dbErr } =
        await supabase
          .from("teacher_notes")
          .insert([{
            teacher_id,
            class_name,
            subject,
            title,
            pdf_url: pdfUrl
          }]);

      if (dbErr) {
        console.log("DB ERROR:", dbErr);
        return res.status(500).json({ error: dbErr.message });
      }

      res.json({ success: true });

    } catch (err) {
      console.log("SERVER CRASH:", err);
      res.status(500).json({ error: "Server crashed" });
    }
  }
);


// ================= GET NOTES =================
app.get("/getTeacherNotes", async (req, res) => {
    try {
        const { teacher_id, class_name, subject } = req.query;

        const { data, error } = await supabase
            .from("teacher_notes")
            .select("*")
            .eq("teacher_id", teacher_id)
            .eq("class_name", class_name)
            .eq("subject", subject)
            .order("id", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        res.json(data);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ================= UPDATE NOTES =================
app.put("/updateTeacherNotes/:id", async (req, res) => {
    const { id } = req.params;
    const { title } = req.body;

    const { error } = await supabase
        .from("teacher_notes")
        .update({ title })
        .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
});

// ================= DELETE NOTES =================
app.delete("/deleteTeacherNotes/:id", async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from("teacher_notes")
        .delete()
        .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
});


// ================= TEACHER : STUDENTS LIST =================
app.get("/api/teacher/students", async (req, res) => {
  try {
    const { class_id, section_id } = req.query;

    if (!class_id || !section_id) {
      return res.json([]);
    }

    const { data, error } = await supabase
      .from("students")
      .select(`
        auth_id,
        roll_no,
        father_name,
        users (
          name
        )
      `)
      .eq("class_id", class_id)
      .eq("section_id", section_id)
      .order("roll_no");

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

//........................GET STUDENTS Attendance............
app.get("/getStudents", async (req, res) => {
  try {
    const { class_id, section_id } = req.query;

    let query = supabase
      .from("students")
      .select(`
        auth_id,
        roll_no,
        class_id,
        section_id,
        users ( name )
      `)
      .order("roll_no");

    if (class_id) query = query.eq("class_id", class_id);
    if (section_id) query = query.eq("section_id", section_id);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    res.status(500).json([]);
  }
});

//.....................
app.post("/api/teacher/attendance", async (req, res) => {
  try {
    const { class_id, section_id, date, attendance } = req.body;

    if (!class_id || !section_id || !date || !attendance?.length) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const records = attendance.map(a => ({
      auth_id: a.auth_id,   // 🔥 auth_id use
      class_id,
      section_id,
      date,
      status: a.status
    }));

    const { error } = await supabase
      .from("student_attendance")
      .upsert(records, {
        onConflict: "auth_id,date"
      });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/student/attendance-summary", async (req, res) => {
  try {
    const { auth_id } = req.query;
    if (!auth_id) return res.json({});

    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("student_attendance")
      .select("status")
      .eq("auth_id", auth_id)
      .eq("date", today)
      .maybeSingle();

    res.json({
      today: data?.status || "not_marked"
    });
  } catch {
    res.json({});
  }
});
app.get("/api/student/attendance-calendar", async (req, res) => {
  try {
    const { auth_id, year, month } = req.query;
    if (!auth_id) return res.json([]);

    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end   = `${year}-${String(month).padStart(2, "0")}-31`;

    const { data } = await supabase
      .from("student_attendance")
      .select("date, status")
      .eq("auth_id", auth_id)
      .gte("date", start)
      .lte("date", end)
      .order("date");

    res.json(data || []);
  } catch {
    res.json([]);
  }
});

app.get("/getClasses", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("classes")
      .select("class_id, class_name")
      .order("class_name");

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/getSections", async (req, res) => {
  try {
    // class_id ignore hoga kyunki DB me nahi hai
    const { data, error } = await supabase
      .from("sections")
      .select("section_id, section_name")
      .order("section_name");

    if (error) throw error;

    // ALWAYS array
    res.json(data || []);
  } catch (err) {
    res.status(500).json([]);
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

/* ---------- GET CLASSES ---------- */
app.get("/api/admin/classes", async (req, res) => {
  const { data, error } = await supabase
    .from("classes")
    .select("class_id, class_name")
    .order("class_name");

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

/* ---------- GET SECTIONS (CLASS INDEPENDENT) ---------- */
app.get("/api/admin/sections/:class_id", async (req, res) => {
  const { data, error } = await supabase
    .from("sections")
    .select("section_id, section_name")
    .order("section_name");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data || []);
});


/* =================================================
   ================= FEES ===========================
   ================================================= */
app.get("/api/admin/fees", async (req, res) => {
  const { class_id, section_id, month, fee_type } = req.query;

  let query = supabase
    .from("student_fees")
    .select(`
      id,
      fee_type,
      month,
      amount,
      status,
      students:students!inner (
        auth_id,
        class_id,
        section_id,
        users:users!inner ( name ),
        classes:classes!inner ( class_name ),
        sections:sections!inner ( section_name )
      )
    `);

  if (month && month !== "ALL") query = query.eq("month", month);
  if (fee_type && fee_type !== "ALL") query = query.eq("fee_type", fee_type);

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }

  const filtered = data.filter(f => {
    const s = f.students;

    if (class_id && class_id !== "ALL" && s.class_id !== Number(class_id)) {
      return false;
    }

    if (section_id && section_id !== "ALL" && s.section_id !== Number(section_id)) {
      return false;
    }

    return true;
  });

  const result = filtered.map(f => ({
    id: f.id,
    fee_type: f.fee_type,
    month: f.month,
    amount: f.amount,
    status: f.status,
    student_name: f.students.users.name,
    class_name: f.students.classes.class_name,
    section_name: f.students.sections.section_name
  }));

  res.json(result);
});


/* ---------- UPDATE FEE STATUS ----------*/
app.post("/api/admin/fee-status", async (req, res) => {
  const { fee_id, status } = req.body;

  const { error } = await supabase
    .from("student_fees")
    .update({ status })
    .eq("id", fee_id);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: "Fee status updated" });
});


/* ---------- BULK MONTHLY FEE ---------- */
app.post("/api/admin/bulk-fee", async (req, res) => {
  const { class_id, section_id, month, amount } = req.body;

  let studentQuery = supabase
    .from("students")
    .select("auth_id")
    .eq("class_id", class_id);

  if (section_id && section_id !== "ALL") {
    studentQuery = studentQuery.eq("section_id", section_id);
  }

  const { data: students, error } = await studentQuery;
  if (error) return res.status(500).json({ error: error.message });

  if (!students?.length) {
    return res.json({ message: "No students found" });
  }

  const feeRows = students.map(s => ({
    auth_id: s.auth_id,
    fee_type: "Monthly",
    month,
    amount,
    status: "DUE"
  }));

  const { error: insertError } = await supabase
    .from("student_fees")
    .insert(feeRows);

  if (insertError) return res.status(500).json({ error: insertError.message });

  res.json({ message: "Bulk fee generated" });
});


// =========================================================================
//                         ADMIN PROFILE

// =========================================================================
//                         SERVER START
// =========================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});



































































