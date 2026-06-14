import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { JsonWebTokenError } from "jsonwebtoken";
import { JWT_PASSWORD } from "./config.js";


// add timeout to jwt token

export const userMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers["authorization"];
    const decoded = jwt.verify(header as string, JWT_PASSWORD);
    if (decoded) {
        // @ts-ignore - change this is future
        req.userId = decoded.id;
        next();
    } else {
        res.status(403).json({
            message: "You are not logged in"
        })
    }
}