import { DataSource as TypeOrmDataSource } from 'typeorm';
import { DataSource, Exchange, MarketIndex } from '../entities';
import { DataSourceType } from '../enums';

export async function seedDatabase(dataSource: TypeOrmDataSource): Promise<void> {
  const exchangeRepository = dataSource.getRepository(Exchange);
  const dataSourceRepository = dataSource.getRepository(DataSource);
  const marketIndexRepository = dataSource.getRepository(MarketIndex);

  console.log('Seeding exchanges...');
  const exchanges = [
    { code: 'HOSE', name: 'Ho Chi Minh Stock Exchange' },
    { code: 'HNX', name: 'Hanoi Stock Exchange' },
    { code: 'UPCOM', name: 'Unlisted Public Company Market' },
  ];

  await exchangeRepository.upsert(exchanges, ['code']);
  const savedExchanges = await exchangeRepository.find({
    where: exchanges.map((exchange) => ({ code: exchange.code })),
  });
  console.log(`  Upserted exchanges: ${exchanges.map((exchange) => exchange.code).join(', ')}`);

  console.log('Seeding market indices...');
  const exchangeMap = new Map(savedExchanges.map((e) => [e.code, e.id]));

  const indices = [
    { code: 'VNINDEX', name: 'VN Index', exchangeCode: 'HOSE' },
    { code: 'HNXINDEX', name: 'HNX Index', exchangeCode: 'HNX' },
    { code: 'UPCOMINDEX', name: 'UPCOM Index', exchangeCode: 'UPCOM' },
    { code: 'VN30', name: 'VN30 Index', exchangeCode: 'HOSE' },
  ];

  await marketIndexRepository.upsert(
    indices.map((index) => ({
      code: index.code,
      name: index.name,
      exchangeId: exchangeMap.get(index.exchangeCode),
    })),
    ['code'],
  );
  console.log(`  Upserted indices: ${indices.map((index) => index.code).join(', ')}`);

  console.log('Seeding data sources...');
  const dataSources = [
    {
      code: 'TCBS_API',
      name: 'TCBS Securities API',
      baseUrl: 'https://apipubaws.tcbs.com.vn',
      type: DataSourceType.MARKET,
    },
    {
      code: 'SIMPLIZE_API',
      name: 'Simplize API',
      baseUrl: 'https://api2.simplize.vn',
      type: DataSourceType.MARKET,
    },
    {
      code: 'SSI_API',
      name: 'SSI Securities API',
      baseUrl: 'https://iboard.ssi.com.vn',
      type: DataSourceType.MARKET,
    },
    {
      code: 'VNDIRECT_HTML',
      name: 'VNDirect Web Scraper',
      baseUrl: 'https://www.vndirect.com.vn',
      type: DataSourceType.MARKET,
    },
    {
      code: 'CAFEF_HTML',
      name: 'CafeF News Scraper',
      baseUrl: 'https://cafef.vn',
      type: DataSourceType.NEWS,
    },
    {
      code: 'VNAPPMOB_GOLD',
      name: 'VN App Mobile Gold API',
      baseUrl: 'https://api.vnappmob.com',
      type: DataSourceType.GOLD,
    },
    {
      code: 'SJC_HTML',
      name: 'SJC Gold Price',
      baseUrl: 'https://sjc.com.vn',
      type: DataSourceType.GOLD,
    },
  ];

  await dataSourceRepository.upsert(
    dataSources.map((source) => ({
      ...source,
      isActive: true,
    })),
    ['code'],
  );
  console.log(`  Upserted data sources: ${dataSources.map((source) => source.code).join(', ')}`);

  console.log('Seed completed successfully!');
}
