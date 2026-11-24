import { DynamicModule, Module } from '@nestjs/common';
import { AccessService } from './access/access.service';
import { GoogleLoginService } from './auth/google-login.service';
import { GOOGLE_HTTP, GoogleService, type Http } from './google/google.service';
import { GoogleController } from './google/google.controller';
import { AttachmentsController } from './attachments/attachments.controller';
import { AttachmentsService } from './attachments/attachments.service';
import { AzureBlobStore, BLOB_STORE, type BlobStore } from './attachments/blob-store';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { RecoveryService } from './auth/recovery.service';
import { AcsMailer } from './mail/acs-mailer';
import { ChangesService } from './realtime/changes.service';
import { EventsController } from './realtime/events.controller';
import { RemindersController } from './reminders/reminders.controller';
import { RemindersService } from './reminders/reminders.service';
import { NoSystemMailer, SYSTEM_MAILER, type SystemMailer } from './mail/mailer';
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
import { StandupsController } from './standups/standups.controller';
import { StandupsService } from './standups/standups.service';
import { SessionGuard } from './auth/session.guard';
import { HealthController } from './health/health.controller';
import { MetricsService } from './observability/metrics.service';
import { TicketsController } from './tickets/tickets.controller';
import { TicketsService } from './tickets/tickets.service';
import { SpacesController } from './spaces/spaces.controller';
import { SpacesService } from './spaces/spaces.service';

/** Things a test replaces: file storage, email, and the way Google is reached. The real server uses none of these. */
export interface AppOverrides { blobStore?: BlobStore; emailSender?: EmailSender; systemMailer?: SystemMailer; googleHttp?: Http }

@Module({})
export class AppModule {
  /** `blobStore` lets a test supply file storage in memory; the real server builds Azure Blob Storage from its settings, or none. */
  static forRoot(config: Config, overrides: AppOverrides = {}): DynamicModule {
    const blobStore = overrides.blobStore ?? (config.storage ? new AzureBlobStore(config.storage.account, config.storage.key, config.storage.container) : null);
    return {
      module: AppModule,
      controllers: [AuthController, RemindersController, EventsController, SpacesController, TicketsController, AttachmentsController, KvController, PeopleController, ObjectsController, InvitationsController, StandupsController, GoogleController, HealthController],
      providers: [{ provide: CONFIG, useValue: config }, DbService, AuditService, MetricsService, AuthService, RecoveryService, RemindersService, ChangesService, ClientGuard, SessionGuard, SpacesService, TicketsService, AttachmentsService, KvService, AccessService, PeopleService, ObjectsService, InvitationsService, StandupsService,
        { provide: BLOB_STORE, useValue: blobStore }, GoogleService, GoogleLoginService, { provide: GOOGLE_HTTP, useValue: overrides.googleHttp ?? fetch },
        { provide: SYSTEM_MAILER, useValue: overrides.systemMailer ?? (config.mail ? new AcsMailer(config.mail.connectionString, config.mail.from) : new NoSystemMailer()) },
        { provide: EMAIL_SENDER, useFactory: (google: GoogleService) => overrides.emailSender ?? (config.google ? google : new NoEmailSender()), inject: [GoogleService] }],
    };
  }
}
