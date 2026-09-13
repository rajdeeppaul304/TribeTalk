import mongoose, { Schema, Types } from "mongoose";
import { randomUUID } from "node:crypto";

const serverSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },

    description: {
      type: String,
      maxlength: 200,
      default: "",
    },

    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
      default: () => randomUUID(),
    },

    owner: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    moderators: [
      {
        type: Types.ObjectId,
        ref: "User",
      },
    ],

    members: [
      {
        type: Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// export default mongoose.model("Server", serverSchema);

export const Server = mongoose.model("Server", serverSchema)
