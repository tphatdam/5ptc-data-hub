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

  const savedExchanges: Exchange[] = [];
  for (const exchange of exchanges) {
    const existing = await exchangeRepository.findOne({ where: { code: exchange.code } });
    if (!existing) {
      const saved = await exchangeRepository.save(exchangeRepository.create(exchange));
      savedExchanges.push(saved);
      console.log(`  Created exchange: ${exchange.code}`);
    } else {
      savedExchanges.push(existing);
      console.log(`  Exchange exists: ${exchange.code}`);
    }
  }

  console.log('Seeding market indices...');
  const exchangeMap = new Map(savedExchanges.map((e) => [e.code, e.id]));
  
  const indices = [
    { code: 'VNINDEX', name: 'VN Index', exchangeCode: 'HOSE' },
    { code: 'HNXINDEX', name: 'HNX Index', exchangeCode: 'HNX' },
    { code: 'UPCOMINDEX', name: 'UPCOM Index', exchangeCode: 'UPCOM' },
    { code: 'VN30', name: 'VN30 Index', exchangeCode: 'HOSE' },
  ];

  for (const index of indices) {
    const existing = await marketIndexRepository.findOne({ where: { code: index.code } });
    if (!existing) {
      await marketIndexRepository.save(
        marketIndexRepository.create({
          code: index.code,
          name: index.name,
          exchangeId: exchangeMap.get(index.exchangeCode),
        })
      );
      console.log(`  Created index: ${index.code}`);
    } else {
      console.log(`  Index exists: ${index.code}`);
    }
  }

  console.log('Seeding data sources...');
  const dataSources = [
    {
      code: 'TCBS_API',
      name: 'TCBS Securities API',
      baseUrl: 'https://apipubaws.tcbs.com.vn',
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

  for (const ds of dataSources) {
    const existing = await dataSourceRepository.findOne({ where: { code: ds.code } });
    if (!existing) {
      await dataSourceRepository.save(dataSourceRepository.create(ds));
      console.log(`  Created data source: ${ds.code}`);
    } else {
      console.log(`  Data source exists: ${ds.code}`);
    }
  }

  console.log('Seed completed successfully!');
}
