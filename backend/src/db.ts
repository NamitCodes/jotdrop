// create user models and schemas here
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { model, Schema } from 'mongoose';

// Ensure environment variables are loaded
dotenv.config();

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGO_URI;

    if (!uri) {
      throw new Error("❌ MongoDB URI is not defined in the environment variables.");
    }

    const conn = await mongoose.connect(uri);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    } else {
      console.error('❌ An unknown error occurred while connecting to MongoDB');
    }
    // Exit the process with failure if the database connection drops
    process.exit(1); 
  }
};

const UserSchema = new Schema({
    username : {type: String, unique: true},
    password: String
})

const TagSchema = new Schema({
  title: {type: String, required: true, unique: true}
})

const contentTypes = ['image', 'video', 'article', 'audio', 'tweet', 'insta-post', 'insta-reel', 'text'];
const ContentSchema = new Schema({
  title: { type: String, required: true },
  type: { type: String, enum: contentTypes, required: true },
  link: { type: String, required: false },
  body: { type: String, required: false },
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const LinkSchema = new Schema({
    hash: {type: String, unique: true, required: true},
    type: { type: String, enum: ['single', 'library'], required: true },

    // optional depending on the type
    contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }
}, {timestamps: true})

LinkSchema.index({ userId: 1, type: 1 }, { unique: true, partialFilterExpression: { type: 'library' } });
LinkSchema.index({ contentId: 1, type: 1 }, { unique: true, partialFilterExpression: { type: 'single' } });

export const UserModel = model("User", UserSchema);
export const TagModel = model("Tag", TagSchema);
export const ContentModel = model("Content", ContentSchema);
export const LinkModel = model("Link", LinkSchema);
