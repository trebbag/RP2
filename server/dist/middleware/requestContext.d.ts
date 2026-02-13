import type { NextFunction, Response } from "express";
import type { BaseRequest } from "../types.js";
export declare function requestContext(req: BaseRequest, res: Response, next: NextFunction): void;
