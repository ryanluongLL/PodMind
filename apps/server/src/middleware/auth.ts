import { clerkMiddleware, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export const clerkAuth = clerkMiddleware()


export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const { userId } = getAuth(req)
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
    }
    ///attach userId to request so routes can use it
    ; (req as Request & { userId: string }).userId = userId
    next()
}