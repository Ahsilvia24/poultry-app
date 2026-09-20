/** Offline-only. No Prisma client is shipped on Vercel. */
export const prisma: any = new Proxy(
  {},
  {
    get: () =>
      new Proxy(
        {},
        {
          get: () => () => {
            throw new Error("No database");
          },
        },
      ),
  },
);
