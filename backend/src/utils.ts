import crypto from "crypto"

export function generateHash(length: number = 10) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex') 
        .slice(0, length); 
};