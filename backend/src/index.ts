import express from "express";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import z from "zod";
import bcrypt from "bcrypt";
import { connectDB, ContentModel, LinkModel, UserModel } from './db.js';
import { JWT_PASSWORD } from "./config.js";
import { userMiddleware } from "./middleware.js";
import { random } from "./utils.js";

// add zod validation - line 132
// add sign in with google auth
// redo and reconfirm apis
// start with frontend

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health Check
app.get("/", (req, res) => {
    res.status(200).json({
        message: "Server is running",
    });
});

const signupSchema = z.object({
    username: z.email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters long")
});

const signinSchema = z.object({
    username: z.email("Invalid email format"),
    password: z.string().min(6, "Password is required")
});

// Signup
app.post("/api/v1/signup", async (req, res) => {
    const validation = signupSchema.safeParse(req.body);
    if (!validation.success){
        return res.status(400).json({
            message: "Validation failed",
            error: validation.error.message
        });
    }
    const username = validation.data.username;
    const password = validation.data.password;
    
    const saltRounds = 10;
    
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await UserModel.create({
            username: username,
            password: hashedPassword
        })
        return res.status(201).json({
        message: "User Signed Up Successfully",
    });          
    } catch (error: any) {
        console.error("Signup error:", error);

        // mongodb duplicate key error
        if (error?.code === 11000) {
            return res.status(409).json({
                message: "User already exists"
            });
        }

        return res.status(500).json({
            message: "Internal server error occurred"
        });
    }
});

// Signin
app.post("/api/v1/signin", async (req, res) => {
    const validation = signinSchema.safeParse(req.body);
    if (!validation.success){
        return res.status(400).json({
            message: "Validation failed",
            errors: validation.error.message
        })
    }

    const {username, password} = validation.data;

    try {
        const existingUser = await UserModel.findOne({
            username
        })

        if (!existingUser) {
            return res.status(403).json({
                message: "Incorrect credentials"
            });
        }

        const isPasswordMatch = await bcrypt.compare(password, existingUser.password || "");

        if (!isPasswordMatch){
            return res.status(403).json({
                message: "Incorrect Credentials"
            })
        }

        const token = jwt.sign(
            {id: existingUser._id},
            JWT_PASSWORD,
            {expiresIn: "1d"}
        )

        return res.json({
            token: token
        })
        
    } catch (error) {
        console.error("Signin error:", error);
        return res.status(500).json({
            message: "Internal Server Error"
        })
    }
});

// add zod validation from here now
// Create Content
app.post("/api/v1/content", userMiddleware,  async (req, res) => {
    const title = req.body.title;
    const link = req.body.link; // even if title and link are empty.. post req is being sent
    const type = req.body.type;

    await ContentModel.create({
        title, 
        link, 
        type,
        // @ts-ignore
        userId: req.userId,
        tags: []
    })


    return res.json({
        message: "Content added",
    });
});

// Get Content
app.get("/api/v1/content",userMiddleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;
    const content = await ContentModel.find({
        userId: userId
    }).populate("userId", "username"); // populate used to also get the original author to which this content belongs.. comes via ref
    res.json({
        content
    });
});

// Delete Content
app.delete("/api/v1/content", userMiddleware, async (req, res) => {
    const contentId = req.body.contentId;

    await ContentModel.deleteMany({
        contentId,
        // @ts-ignore
        userId: req.userId
    })
    res.json({
        message: "Delete content endpoint",
    });
});

// Share Brain
app.post("/api/v1/brain/share", userMiddleware, async(req, res) => {
    const share = req.body.share;
    if (share){
        const existingLink = await LinkModel.findOne({
            // @ts-ignore
            userId: req.userId
        })
        if (existingLink){
            res.json({
                hash: existingLink.hash
            })
            return;
        }

        const hash = random(10);
        await LinkModel.create({
            // @ts-ignore
            userId: req.userId,
            hash: hash
        })
        res.json({
            message: "/share/" + hash
        })
    } else {
        await LinkModel.deleteOne({
            // @ts-ignore
            userId: req.userId
        })
        res.json({
            message: "Brain unshared"
        })
    }
});

// Access Shared Brain
app.get("/api/v1/brain/:shareLink", async (req, res) => {
    const hash = req.params.shareLink;
    const link = await LinkModel.findOne({
        hash: hash
    })
    if (!link){
        res.status(411).json({
            message: "Sorry incorrect input"
        })
        return;
    } 

    const content = await ContentModel.find({
        userId: link.userId
    })

    const user = await UserModel.findOne({
        _id: link.userId
    })

    if (!user){
        res.status(411).json({
            message: "user not found, error ideally should not happen"
        })
    }

    res.json({
        username : user?.username,
        content
    });
});


// Initialize Database and Start Server
const startServer = async () => {
  // Wait for the database connection to establish
  await connectDB();
  
  // Start the server
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
};

startServer();

