export function adminUser(
  overrides?: Partial<{ email: string; role: string }>,
) {
  return {
    id: "user-admin",
    email: overrides?.email ?? "admin@test.com",
    role: overrides?.role ?? "admin",
    name: "Admin",
  };
}

export function nonAdminUser() {
  return {
    id: "user-regular",
    email: "user@test.com",
    role: "user",
    name: "User",
  };
}
