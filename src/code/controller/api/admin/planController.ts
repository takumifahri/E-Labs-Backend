import { Request, Response } from "express";
import { isBlacklisted } from "../../../utils/jwt";
import { verifyJWTToken } from "../../../utils/hash";
import { PrismaClient } from "@prisma/client";
import { CreatePlanRequest, Plan, PlanResponse, UpdatePlanRequest } from "../../../models/Plan";
import { v4 as uuidv4 } from "uuid";
import { debug, error } from "node:console";
import { queryObjects } from "node:v8";
import { logger } from "../../../utils/logger";

const prisma = new PrismaClient();

const createPlanForUser = async (req: Request, res: Response) => {
    const { forWhoUid, Status, NamePlan, Start, End }: CreatePlanRequest = req.body;
    const uniqueId = `PLN-${uuidv4()}`;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized, token is missing" });
    }
    const token = authHeader.split(" ")[1];

    if (isBlacklisted(token)) {
        return res.status(401).json({ message: "Unauthorized, token is blacklisted" });
    }

    let decodedToken: any;
    try {
        decodedToken = await verifyJWTToken(token);
        if (!decodedToken || !decodedToken.uniqueId) {
            return res.status(401).json({ message: "Unauthorized, invalid token" });
        }
    } catch {
        return res.status(401).json({ message: "Unauthorized, invalid token" });
    }

    const createdById = decodedToken.uniqueId;

    try {
        // Check if the target user exists
        const forWho = await prisma.user.findUnique({
            where: { uniqueId: forWhoUid }
        });
        if (!forWho) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if creator exists (should always exist if token valid, but for safety)
        const creator = await prisma.user.findUnique({
            where: { uniqueId: createdById }
        });
        if (!creator) {
            return res.status(404).json({ message: "Creator not found" });
        }

        const newPlan = await prisma.plan.create({
            data: {
                uniqueId,
                forWhoUid,
                createdById,
                Status,
                NamePlan,
                Start: new Date(Start),
                End: new Date(End),
            },
        });

        const planResponse: PlanResponse = {
            UniqueId: newPlan.uniqueId,
            forWhoUid: newPlan.forWhoUid,
            createdByUUid: newPlan.createdById,
            NamePlan: newPlan.NamePlan,
            Status: newPlan.Status,
            Start: new Date(newPlan.Start),
            End: new Date(newPlan.End),
            createdAt: new Date(newPlan.createdAt),
            updatedAt: new Date(newPlan.updatedAt),
        }
        if (!newPlan) {
            console.log("Plan creation failed", error); // Log the error for debugging
            return res.status(400).json({ message: "Plan creation failed" });
        }
        return res.status(201).json({
            message: "Plan created successfully",
            data: planResponse
        });
    } catch (error) {
        console.error("Error creating plan:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const getPlanById = async (req: Request, res: Response) => {
    const { uniqueId } = req.params;
    try {
        const plan = await prisma.plan.findUnique({
            where: { uniqueId }
        });
        if (!plan) {
            return res.status(404).json({ message: "Plan not found" });
        }

        const planResponse: PlanResponse = {
            UniqueId: plan.uniqueId,
            forWhoUid: plan.forWhoUid,
            createdByUUid: plan.createdById,
            NamePlan: plan.NamePlan,
            Status: plan.Status,
            Start: new Date(plan.Start),
            End: new Date(plan.End),
            createdAt: new Date(plan.createdAt),
            updatedAt: new Date(plan.updatedAt),
        };

        return res.status(200).json({
            message: "Plan retrieved successfully",
            data: planResponse
        });
    } catch (error) {
        console.error("Error retrieving plan:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const updatePlanById = async (req: Request, res: Response) => {
    const { uniqueId } = req.params;
    const { forWhoUid, Status, NamePlan, Start, End }: UpdatePlanRequest = req.body;

    // Yang hanya bisa si forWhoId yang bisa update
    // kita authorisasi jwt
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized, token is missing" });
    }

    // Extract the token from the Authorization header
    const token = authHeader.split(" ")[1];
    if (isBlacklisted(token)) {
        return res.status(401).json({ message: "Unauthorized, token is blacklisted" });
    }

    let decodedToken: any;
    try {
        decodedToken = await verifyJWTToken(token);
        if (!decodedToken || !decodedToken.uniqueId) {
            return res.status(401).json({ message: "Unauthorized, invalid token" });
        }
    } catch (error) {
        return res.status(401).json({ message: "Unauthorized, invalid token" });
    }

    const forWhoId = decodedToken.uniqueId;
    try {
        const existingPlan = await prisma.plan.findUnique({
            where: { uniqueId }
        });

        if (!existingPlan) {
            return res.status(404).json({ message: "Plan not found" });
        }

        // Check if the user is authorized to update this plan
        if (existingPlan.forWhoUid !== forWhoId) {
            return res.status(403).json({ message: "Forbidden, you are not authorized to update this plan" });
        }

        const updatedPlan = await prisma.plan.update({
            where: { uniqueId },
            data: {
                forWhoUid: forWhoUid ?? existingPlan.forWhoUid,
                Status: Status ?? existingPlan.Status, // field Prisma harus 'Status'
                NamePlan: NamePlan ?? existingPlan.NamePlan,
                Start: Start ? new Date(Start) : existingPlan.Start,
                End: End ? new Date(End) : existingPlan.End,
                updatedAt: new Date()
            }
        });

        const planResponse: PlanResponse = {
            UniqueId: updatedPlan.uniqueId,
            forWhoUid: updatedPlan.forWhoUid,
            createdByUUid: updatedPlan.createdById,
            NamePlan: updatedPlan.NamePlan,
            Status: updatedPlan.Status,
            Start: new Date(updatedPlan.Start),
            End: new Date(updatedPlan.End),
            createdAt: new Date(updatedPlan.createdAt),
            updatedAt: new Date(updatedPlan.updatedAt),
        };

        return res.status(200).json({
            message: "Plan updated successfully",
            data: planResponse
        });
    } catch (error) {
        console.error("Error updating plan:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

const getAllPlans = async (req: Request, res: Response) => {
    const {
        UniqueId,
        forWhoUid,
        createdByUUid,
        NamePlan,
        Status,
        Start,
        End,
        NamePlan_like,
        StatusLike,
        Start_gte,
        Start_lte,
        End_gte,
        End_lte,
        search // search global (opsional)
    } = req.query;
    logger.info("getAllPlans called with query:", req.query);
    logger.trace("Start getAllPlans", req.query);
    logger.time("getAllPlans");

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized, token is missing" });
    }
    const token = authHeader.split(" ")[1];
    if (isBlacklisted(token)) {
        return res.status(401).json({ message: "Unauthorized, token is blacklisted" });
    }
    let decodedToken: any;
    try {
        decodedToken = await verifyJWTToken(token);
        if (!decodedToken || !decodedToken.uniqueId) {
            return res.status(401).json({ message: "Unauthorized, invalid token" });
        }
    } catch (error) {
        return res.status(401).json({ message: "Unauthorized, invalid token" });
    }

    // Build dynamic filter
    const filter: any = {};
    if (UniqueId) filter.uniqueId = UniqueId as string;
    if (forWhoUid) filter.forWhoUid = forWhoUid as string;
    if (createdByUUid) filter.createdById = createdByUUid as string;
    if (NamePlan) filter.NamePlan = NamePlan as string;
    if (Status) filter.Status = Status as string;
    if (Start) filter.Start = new Date(Start as string);
    if (End) filter.End = new Date(End as string);

    // Partial match (search)
    if (NamePlan_like) filter.NamePlan = { contains: NamePlan_like as string, mode: "insensitive" };
    if (StatusLike) filter.Status = { contains: StatusLike as string, mode: "insensitive" };

    if (search) {
        const searchStr = search as string;
        const statusEnumValues = ['notyet', 'onprogres', 'completed'];
        filter.OR = [
            { uniqueId: { contains: searchStr, mode: "insensitive" } },
            { forWhoUid: { contains: searchStr, mode: "insensitive" } },
            { createdById: { contains: searchStr, mode: "insensitive" } },
            { NamePlan: { contains: searchStr, mode: "insensitive" } },
        ];
        // Jika search cocok dengan enum Status, tambahkan exact match
        if (statusEnumValues.includes(searchStr)) {
            filter.OR.push({ Status: searchStr as any });
        }
    }

    // Date range
    if (Start_gte || Start_lte) {
        filter.Start = {};
        if (Start_gte) filter.Start.gte = new Date(Start_gte as string);
        if (Start_lte) filter.Start.lte = new Date(Start_lte as string);
    }
    if (End_gte || End_lte) {
        filter.End = {};
        if (End_gte) filter.End.gte = new Date(End_gte as string);
        if (End_lte) filter.End.lte = new Date(End_lte as string);
    }

    // Role-based filtering
    if (decodedToken.roles === 'user') {
        filter.forWhoUid = decodedToken.uniqueId;
    }
    logger.info("Filter for getAllPlans:", filter);
    logger.time("getAllPlans");
    try {
        const plans = await prisma.plan.findMany({ where: filter });
        logger.info("Plans retrieved:", plans.length, "plans found");
        const planResponses: PlanResponse[] = plans.map(plan => ({
            UniqueId: plan.uniqueId,
            forWhoUid: plan.forWhoUid,
            createdByUUid: plan.createdById,
            NamePlan: plan.NamePlan,
            Status: plan.Status,
            Start: new Date(plan.Start),
            End: new Date(plan.End),
            createdAt: new Date(plan.createdAt),
            updatedAt: new Date(plan.updatedAt),
        }));
        return res.status(200).json({
            message: "Plans retrieved successfully",
            data: planResponses
        });
    } catch (error) {
        console.error("Error retrieving plans:", error);
        logger.error("Error retrieving plans:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
    
};

const deletePlanById = async (req: Request, res: Response) => {
    const { uniqueId } = req.params;
    logger.info("deletePlanById called with uniqueId:", uniqueId);
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized, token is missing" });
    }
    const token = authHeader.split(" ")[1];
    if (isBlacklisted(token)) {
        return res.status(401).json({ message: "Unauthorized, token is blacklisted" });
    }
    let decodedToken: any;
    try {
        decodedToken = await verifyJWTToken(token);
        if (!decodedToken || !decodedToken.uniqueId) {
            return res.status(401).json({ message: "Unauthorized, invalid token" });
        }
    } catch (error) {
        return res.status(401).json({ message: "Unauthorized, invalid token" });
    }

    if (decodedToken.roles !== 'admin') {
        return res.status(403).json({ message: "Forbidden, you are not authorized to delete this plan" });
    }
    try {
        const plan = await prisma.plan.findUnique({
            where: { uniqueId }
        });
        if (!plan) {
            return res.status(404).json({ message: "Plan not found" });
        }

        await prisma.plan.update({
            where: { uniqueId },
            data: { deletedAt: new Date() }
        });

        return res.status(200).json({ message: "Plan deleted successfully" });
    } catch (error) {
        console.error("Error deleting plan:", error);
        logger.error("Error deleting plan:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

const deletePermanentlyPlanById = async (req: Request, res: Response) => {
    const { uniqueId } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized, token is missing" });
    }

    const token = authHeader.split(" ")[1];
    if (isBlacklisted(token)) {
        return res.status(401).json({ message: "Unauthorized, token is blacklisted" });
    }
    let decodedToken: any;
    try {
        decodedToken = await verifyJWTToken(token);
        if (!decodedToken || !decodedToken.uniqueId) {
            return res.status(401).json({ message: "Unauthorized, invalid token" });
        }
    } catch (error) {
        return res.status(401).json({ message: "Unauthorized, invalid token" });
    }

    if (decodedToken.roles !== 'admin') {
        return res.status(403).json({ message: "Forbidden, you are not authorized to delete this plan" });
    }
    try {
        const plan = await prisma.plan.findUnique({
            where: { uniqueId }
        });
        if (!plan) {
            return res.status(404).json({ message: "Plan not found" });
        }

        await prisma.plan.delete({
            where: { uniqueId }
        });

        return res.status(200).json({ message: "Plan deleted permanently" });
    } catch (error) {
        console.error("Error deleting plan permanently:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const PlanController = {
    createPlanForUser,
    getPlanById,
    updatePlanById,
    deletePlanById,
    getAllPlans,
    deletePermanentlyPlanById
};

export default PlanController;