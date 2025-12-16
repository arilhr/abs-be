export type JwtPayload = {
  userId: number;
  role: "ADMIN" | "OPERATOR" | string;
};
