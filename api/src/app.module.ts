import { DynamicModule, Module } from '@nestjs/common';
import { AccessService } from './access/access.service';
import { AttachmentsController } from './attachments/attachments.controller';
import { AttachmentsService } from './attachments/attachments.service';
import { AzureBlobStore, BLOB_STORE, type BlobStore } from './attachments/blob-store';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { ClientGuard } from './auth/client.guard';
import { CONFIG, type Config } from './config';
import { DbService } from './db/db.service';
import { EMAIL_SENDER, NoEmailSender, type EmailSender } from './invitations/email';
import { InvitationsController } from './invitations/invitations.controller';
import { InvitationsService } from './invitations/invitations.service';
import { KvController } from './kv/kv.controller';
import { KvService } from './kv/kv.service';
import { ObjectsController } from './objects/objects.controller';
import { ObjectsService } from './objects/objects.service';
import { PeopleController } from './people/people.controller';
import { PeopleService } from './people/people.service';
import { SessionGuard } from './auth/session.guard';
import { HealthController } from './health/health.controller';
import { MetricsService } from './observability/metrics.service';
import { TicketsController } from './tickets/tickets.controller';
import { TicketsService } from './tickets/tickets.service';
import { SpacesController } from './spaces/spaces.controller';
import { SpacesService } from './spaces/spaces.service';

@Module({})
export class AppModule {
  /** `blobStore` lets a test supply file storage in memory; the real server builds Azure Blob Storage from its settings, or none. */
  static forRoot(config: Config, overrides: { blobStore?: BlobStore; emailSender?: EmailSender } = {}): DynamicModule {
    const blobStore = overrides.blobStore ?? (config.storage ? new AzureBlobStore(config.storage.account, config.storage.key, config.storage.container) : null);
    return {
      module: AppModule,
      controllers: [AuthController, SpacesController, TicketsController, AttachmentsController, KvController, PeopleController, ObjectsController, InvitationsController, HealthController],
      providers: [{ provide: CONFIG, useValue: config }, DbService, AuditService, MetricsService, AuthService, ClientGuard, SessionGuard, SpacesService, TicketsService, AttachmentsService, KvService, AccessService, PeopleService, ObjectsService, InvitationsService,
        { provide: BLOB_STORE, useValue: blobStore }, { provide: EMAIL_SENDER, useValue: overrides.emailSender ?? new NoEmailSender() }],
    };
  }
}
