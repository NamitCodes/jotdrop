import express from "express";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import z from "zod";
import bcrypt from "bcrypt";
import { connectDB, ContentModel, LinkModel, UserModel } from "./db.js";
import { JWT_PASSWORD } from "./config.js";
import { userMiddleware } from "./middleware.js";
import { generateHash } from "./utils.js";
import type { Request, Response } from "express";
import crypto from "crypto";

// add sign in with google auth
// redo and reconfirm apis
// start with frontend

// add fields also along with error messages

// apis to add -
// put content/:contentId
// post tags
// get tags
// search and filter apis

// add pagination

// add rate limiting

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

// Fix for TS: Extend the default Express Request to support middleware injected data
interface AuthenticatedRequest extends Request {
  userId?: string;
}

const signupSchema = z.object({
  username: z.email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

// Signup
app.post("/api/v1/signup", async (req, res) => {
  const validation = signupSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message: "Validation failed",
      error: validation.error?.issues?.[0]?.message || "Validation failed",
    });
  }
  const username = validation.data.username;
  const password = validation.data.password;

  const saltRounds = 10;

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await UserModel.create({
      username: username,
      password: hashedPassword,
    });
    return res.status(201).json({
      message: "User Signed Up Successfully",
    });
  } catch (error: any) {
    console.error("Signup error:", error);

    // mongodb duplicate key error
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    return res.status(500).json({
      message: "Internal server error occurred",
    });
  }
});

const signinSchema = z.object({
  username: z.email("Invalid email format"),
  password: z.string().min(6, "Password is required"),
});

// Signin
app.post("/api/v1/signin", async (req, res) => {
  const validation = signinSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: validation.error?.issues?.[0]?.message || "Validation failed",
    });
  }

  const { username, password } = validation.data;

  try {
    const existingUser = await UserModel.findOne({
      username,
    });

    if (!existingUser) {
      return res.status(403).json({
        message: "Incorrect credentials",
      });
    }

    const isPasswordMatch = await bcrypt.compare(
      password,
      existingUser.password || "",
    );

    if (!isPasswordMatch) {
      return res.status(403).json({
        message: "Incorrect Credentials",
      });
    }

    const token = jwt.sign({ id: existingUser._id }, JWT_PASSWORD, {
      expiresIn: "1d",
    });

    return res.json({
      token: token,
    });
  } catch (error) {
    console.error("Signin error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

const createContentSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required and cannot be empty"),
    type: z.enum(
      [
        "image",
        "video",
        "article",
        "audio",
        "tweet",
        "insta-post",
        "insta-reel",
        "text",
      ],
      {
        message: "Invalid content type",
      },
    ),
    link: z
      .url("Please provide a valid URL including https://")
      .optional()
      .or(z.literal("")),
    body: z.string().trim().optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine((data) => data.link || data.body, {
    message: "You must provide either a link or a text body description.",
    path: ["link"], // highlights where the validation error stems from
  });

app.post(
  "/api/v1/content",
  userMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const validation = createContentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => issue.message),
      });
    }

    const { title, link, type, body, tags } = validation.data;

    // Safety check for userMiddleware token extraction
    if (!req.userId) {
      return res.status(401).json({
        message: "Unauthorized: Missing authentication token reference",
      });
    }

    try {
      // 3. Persist content data inside try-catch block
      const newContent = await ContentModel.create({
        title,
        type,
        // Normalizes empty string values to undefined so MongoDB omits them if empty
        link: link || undefined,
        body: body || undefined,
        userId: req.userId,
        tags: tags || [],
      });

      return res.status(201).json({
        message: "Content added successfully",
        contentId: newContent._id,
      });
    } catch (error) {
      console.error("Database save failed:", error);
      return res.status(500).json({
        message: "Internal server error while saving content",
      });
    }
  },
);

const userIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid User ID format");

// Get Content
app.get(
  "/api/v1/content",
  userMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = userIdSchema.safeParse(req.userId);

      if (!validation.success) {
        res.status(401).json({
          message: "Unauthorized: Missing or malformed user credentials",
          errors: validation.error.issues.map((issue) => issue.message),
        });
        return;
      }

      const userId = validation.data;
      const content = await ContentModel.find({ userId })
        .populate("userId", "username")
        .lean(); // .lean() converts Mongoose docs to plain JS objects for faster performance

      if (!content || content.length === 0) {
        res.status(200).json({
          message: "No content found for this user",
          content: [],
        });
        return;
      }

      res.status(200).json({
        message: "Content retrieved successfully",
        content,
      });
    } catch (error) {
      console.error("Error fetching content:", error);

      res.status(500).json({
        message: "An internal server error occurred while retrieving content.",
      });
    }
  },
);

const deleteContentSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid User ID format"),
  contentId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Content ID format"),
});
// Delete Content
app.delete(
  "/api/v1/content",
  userMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = deleteContentSchema.safeParse({
        userId: req.userId,
        contentId: req.body.contentId,
      });

      if (!validation.success) {
        res.status(400).json({
          message: "Validation failed",
          errors: validation.error.issues.map((issue) => issue.message),
        });
        return;
      }

      const { userId, contentId } = validation.data;

      const result = await ContentModel.deleteOne({
        _id: contentId,
        userId: userId,
      });

      if (result.deletedCount === 0) {
        res.status(404).json({
          message:
            "Content not found or you do not have permission to delete it",
        });
        return;
      }

      res.status(200).json({
        message: "Content deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting content:", error);
      res.status(500).json({
        message:
          "An internal server error occurred while trying to delete the content.",
      });
    }
  },
);

const shareBrainSchema = z
  .object({
    share: z.boolean(),
    type: z.enum(["single", "library"]),
    contentId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid Content ID")
      .optional(),
  })
  .refine(
    (data) => {
      // If sharing a 'single' item, contentId MUST be provided
      if (data.share && data.type === "single" && !data.contentId) {
        return false;
      }
      return true;
    },
    {
      message: "contentId is required when sharing type is 'single'",
      path: ["contentId"],
    },
  );

// Share Brain
app.post(
  "/api/v1/brain/share",
  userMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const validation = shareBrainSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          message: "Validation failed",
          errors: validation.error.issues.map((issue) => issue.message),
        });
        return;
      }

      const { share, type, contentId } = validation.data;

      // --- SCENARIO A: ENABLE SHARING (share: true) ---
      if (share) {
        // Define look-up parameters strictly matching your partial indexes
        const queryCondition =
          type === "library"
            ? { userId, type: "library" as const }
            : { contentId, type: "single" as const };

        // Check if this link already exists
        const existingLink = await LinkModel.findOne(queryCondition);
        if (existingLink) {
          res.status(200).json({
            message: "Share link already active",
            hash: existingLink.hash,
          });
          return;
        }

        // Generate a secure hash and create the new entry
        const hash = generateHash(10);
        await LinkModel.create({
          hash,
          type,
          userId: type === "library" ? userId : undefined,
          contentId: type === "single" ? contentId : undefined,
        });

        res.status(201).json({
          message: "Share link generated successfully",
          hash: hash,
        });
        return;
      }

      // --- SCENARIO B: DISABLE SHARING (share: false) ---
      else {
        const deleteCondition =
          type === "library"
            ? { userId, type: "library" as const }
            : { contentId, userId, type: "single" as const }; // Owner verification built-in for singles

        const deleteResult = await LinkModel.deleteOne(deleteCondition);

        if (deleteResult.deletedCount === 0) {
          res.status(404).json({
            message: `No active ${type} share link found to deactivate`,
          });
          return;
        }

        res.status(200).json({
          message: `${type === "library" ? "Brain" : "Content"} unshared successfully`,
        });
        return;
      }
    } catch (error) {
      console.error("Error in share endpoint:", error);
      res.status(500).json({
        message:
          "An internal server error occurred while updating sharing settings.",
      });
    }
  },
);

const paramSchema = z.object({
  shareLink: z.string().min(1, "Share link hash is required"),
});
// Access Shared Brain
app.get("/api/v1/brain/:shareLink", async (req: Request, res: Response) => {
  try {
    const paramValidation = paramSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        message: "Malformed sharing link",
        errors: paramValidation.error.issues.map((issue) => issue.message),
      });
      return;
    }

    const { shareLink } = paramValidation.data;

    const link = await LinkModel.findOne({ hash: shareLink }).populate(
      "userId",
      "username",
    );

    if (!link) {
      res
        .status(404)
        .json({ message: "The shared link does not exist or has expired." });
      return;
    }

    if (link.type === "single") {
      // Fetch only the specific piece of content, and populate its author's username
      const contentItem = await ContentModel.findById(link.contentId)
        .populate("userId", "username")
        .lean();

      if (!contentItem) {
        res
          .status(404)
          .json({ message: "The shared content is no longer available." });
        return;
      }

      res.status(200).json({
        type: "single",
        username: (contentItem.userId as any)?.username || "Unknown User",
        content: [contentItem], // Keep it wrapped in an array to maintain structure stability for your frontend
      });
      return;
    }

    if (link.type === "library") {
      // Ensure the user reference exists on the populated link
      const owner = link.userId as any;
      if (!owner) {
        res
          .status(404)
          .json({ message: "The content owner account could not be found." });
        return;
      }

      const libraryContent = await ContentModel.find({ userId: owner._id })
        .populate("userId", "username")
        .lean();

      res.status(200).json({
        type: "library",
        username: owner.username,
        content: libraryContent,
      });
      return;
    }
  } catch (error) {
    console.error("Error fetching shared brain context:", error);
    res.status(500).json({
      message:
        "An internal server error occurred while retrieving the shared asset.",
    });
  }
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
