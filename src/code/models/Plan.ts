// import { User } from "./user";

// type statusRole = {
//     NOTYET: 'notyet';
//     ONPROGRESS: 'onprogres';
//     COMPLETED: 'completed';
// }

// export interface Plan {
//     UniqueId: string;
//     ForWho: User; // Relasi ke User yang memiliki rencana ini
//     forWhoUid: string;
//     createdBy: User; // Relasi ke User yang membuat rencana ini
//     createdByUUid: string;
//     NamePlan: string;
//     Status: statusRole[keyof statusRole];
//     Start: Date;
//     End: Date;
//     createdAt: Date;
//     updatedAt: Date;
//     deletedAt?: Date;
// }

// export interface CreatePlanRequest {
//     forWhoUid: string; // ID dari User yang memiliki rencana ini
//     createdById: string; // ID dari User yang membuat rencana ini
//     Status: statusRole[keyof statusRole];
//     NamePlan: string;
//     Start: Date;
//     End: Date;
// }

// export interface PlanResponse {
//     UniqueId: string;
//     forWhoUid: string;
//     createdByUUid: string;
//     NamePlan: string;
//     Status: statusRole[keyof statusRole];
//     Start: Date;
//     End: Date;
//     createdAt: Date;
//     updatedAt: Date;
// }

// export interface UpdatePlanRequest {
//     forWhoUid?: string; // ID dari User yang memiliki rencana ini
//     Status?: statusRole[keyof statusRole];
//     NamePlan?: string;
//     Start?: Date;
//     End?: Date;
// }
