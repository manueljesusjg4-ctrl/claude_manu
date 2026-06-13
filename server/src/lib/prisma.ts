// Cliente Prisma compartido por toda la aplicación.
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
