import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid UUID format");
