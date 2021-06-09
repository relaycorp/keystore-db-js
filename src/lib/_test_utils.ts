import { dirname, join } from 'path';
import { Connection, createConnection } from 'typeorm';

const IS_TYPESCRIPT = __filename.endsWith('.ts');
const ENTITIES_DIR_PATH = join(
  dirname(__filename),
  'entities',
  '**',
  IS_TYPESCRIPT ? '*.ts' : '*.js',
);

export function setUpTestDBConnection(): void {
  beforeAll(async () => {
    const connectionOptions = {
      database: ':memory:',
      dropSchema: true,
      entities: [ENTITIES_DIR_PATH],
      logging: false,
      synchronize: true,
      type: 'sqlite',
    };
    connection = await createConnection(connectionOptions as any);
  });

  let connection: Connection;

  beforeEach(async () => {
    await connection.synchronize(true);
  });

  afterEach(async () => {
    await connection.dropDatabase();
  });

  afterAll(async () => {
    await connection.close();
  });
}
