import { DynamicModule, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { ClientGuard } from './auth/client.guard';
import { CONFIG, type Config } from './config';
import { DbService } from './db/db.service';
import { HealthController } from './health/health.controller';
import { MetricsService } from './observability/metrics.service';

@Module({})
export class AppModule {
  static forRoot(config: Config): DynamicModule {
    return {
      module: AppModule,
      controllers: [AuthController, HealthController],
      providers: [{ provide: CONFIG, useValue: config }, DbService, AuditService, MetricsService, AuthService, ClientGuard],
    };
  }
}
