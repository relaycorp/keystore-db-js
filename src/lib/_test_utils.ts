import { dirname, join } from 'path';
import { DataSource } from 'typeorm';

const IS_TYPESCRIPT = __filename.endsWith('.ts');
const ENTITIES_DIR_PATH = join(
  dirname(__filename),
  'entities',
  '**',
  IS_TYPESCRIPT ? '*.ts' : '*.js',
);

export function setUpTestDBDataSource(): () => DataSource {
  let dataSource: DataSource;

  beforeAll(async () => {
    const connectionOptions = {
      database: ':memory:',
      dropSchema: true,
      entities: [ENTITIES_DIR_PATH],
      logging: false,
      synchronize: true,
      type: 'sqlite',
    };
    dataSource = new DataSource(connectionOptions as any);
    await dataSource.initialize();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  afterEach(async () => {
    await dataSource.dropDatabase();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  return () => dataSource;
}
