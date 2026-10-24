process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/language_learning_test";
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? "test-access-secret-at-least-32-characters-long";
process.env.RESET_CODE_PEPPER =
  process.env.RESET_CODE_PEPPER ?? "test-reset-pepper-at-least-32-characters-long";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "30d";
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "sayly-api-test";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "sayly-client-test";
process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:8081";
process.env.ENABLE_SWAGGER = process.env.ENABLE_SWAGGER ?? "true";
process.env.SWAGGER_PATH = process.env.SWAGGER_PATH ?? "/api-docs";
process.env.REDIS_USE_MEMORY = process.env.REDIS_USE_MEMORY ?? "true";
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX ?? "1000";
process.env.LOGIN_RATE_LIMIT_MAX = process.env.LOGIN_RATE_LIMIT_MAX ?? "1000";
process.env.LOGIN_IP_RATE_LIMIT_MAX = process.env.LOGIN_IP_RATE_LIMIT_MAX ?? "1000";
process.env.RESET_RATE_LIMIT_MAX = process.env.RESET_RATE_LIMIT_MAX ?? "1000";
process.env.RESET_IP_RATE_LIMIT_MAX = process.env.RESET_IP_RATE_LIMIT_MAX ?? "1000";
process.env.REFRESH_RATE_LIMIT_MAX = process.env.REFRESH_RATE_LIMIT_MAX ?? "1000";
process.env.UPLOAD_RATE_LIMIT_MAX = process.env.UPLOAD_RATE_LIMIT_MAX ?? "1000";
process.env.MESSAGE_SEND_RATE_LIMIT_MAX = process.env.MESSAGE_SEND_RATE_LIMIT_MAX ?? "1000";
process.env.DISCOVERY_RATE_LIMIT_MAX = process.env.DISCOVERY_RATE_LIMIT_MAX ?? "1000";
process.env.REPORT_RATE_LIMIT_MAX = process.env.REPORT_RATE_LIMIT_MAX ?? "1000";
process.env.MUTATION_RATE_LIMIT_MAX = process.env.MUTATION_RATE_LIMIT_MAX ?? "1000";
process.env.PASSWORD_CHANGE_RATE_LIMIT_MAX = process.env.PASSWORD_CHANGE_RATE_LIMIT_MAX ?? "1000";
process.env.SOCKET_CONNECT_RATE_LIMIT_MAX = process.env.SOCKET_CONNECT_RATE_LIMIT_MAX ?? "1000";
process.env.TYPING_RATE_LIMIT_MAX = process.env.TYPING_RATE_LIMIT_MAX ?? "1000";
process.env.AI_RATE_LIMIT_MAX = process.env.AI_RATE_LIMIT_MAX ?? "1000";
