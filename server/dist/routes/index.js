import { Router } from "express";
import { authRoutes } from "./authRoutes.js";
import { appointmentRoutes } from "./appointmentRoutes.js";
import { encounterRoutes } from "./encounterRoutes.js";
import { draftRoutes } from "./draftRoutes.js";
import { wizardRoutes } from "./wizardRoutes.js";
import { exportRoutes } from "./exportRoutes.js";
import { adminRoutes } from "./adminRoutes.js";
export const apiRoutes = Router();
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/appointments", appointmentRoutes);
apiRoutes.use("/encounters", encounterRoutes);
apiRoutes.use("/wizard", wizardRoutes);
apiRoutes.use("/drafts", draftRoutes);
apiRoutes.use("/exports", exportRoutes);
apiRoutes.use("/admin", adminRoutes);
//# sourceMappingURL=index.js.map