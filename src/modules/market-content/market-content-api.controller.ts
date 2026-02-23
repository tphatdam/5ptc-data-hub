import { Controller, Get, Post, Put, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MarketContentApiService } from './market-content-api.service';
import {
  GetArticlesQueryDto,
  ArticleSearchQueryDto,
  CreateCommentDto,
  SeoUpdateDto,
} from './dto/articles.dto';

@ApiTags('Content / News')
@ApiSecurity('apiKey')
@Controller('api')
export class MarketContentApiController {
  constructor(private readonly service: MarketContentApiService) {}

  @Get('articles')
  @ApiOperation({ summary: 'List articles' })
  @ApiResponse({ status: 200 })
  getArticles(@Query() query: GetArticlesQueryDto) {
    return this.service.getArticles(query as unknown as Record<string, string>);
  }

  @Get('articles/search')
  @ApiOperation({ summary: 'Search articles' })
  @ApiResponse({ status: 200 })
  searchArticles(@Query() query: ArticleSearchQueryDto) {
    return this.service.searchArticles(query as unknown as Record<string, string>);
  }

  @Get('articles/related')
  @ApiOperation({ summary: 'Related articles' })
  @ApiResponse({ status: 200 })
  getRelatedArticles(@Query() query: Record<string, string>) {
    return this.service.getRelatedArticles(query);
  }

  @Get('articles/:identifier')
  @ApiOperation({ summary: 'Get article by identifier' })
  @ApiParam({ name: 'identifier' })
  @ApiResponse({ status: 200 })
  getArticleById(@Param('identifier') identifier: string) {
    return this.service.getArticleById(identifier);
  }

  @Get('article/:slug/next')
  @ApiOperation({ summary: 'Next article by slug' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200 })
  getArticleNext(@Param('slug') slug: string) {
    return this.service.getArticleNext(slug);
  }

  @Get('article/:slug/enriched-symbols')
  @ApiOperation({ summary: 'Enriched symbols for article' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200 })
  getArticleEnrichedSymbols(@Param('slug') slug: string) {
    return this.service.getArticleEnrichedSymbols(slug);
  }

  @Get('news/expert')
  @ApiOperation({ summary: 'Expert news' })
  @ApiResponse({ status: 200 })
  getNewsExpert(@Query() query: Record<string, string>) {
    return this.service.getNewsExpert(query);
  }

  @Get('news/articles')
  @ApiOperation({ summary: 'News articles' })
  @ApiResponse({ status: 200 })
  getNewsArticles(@Query() query: Record<string, string>) {
    return this.service.getNewsArticles(query);
  }

  @Get('news/sentiment')
  @ApiOperation({ summary: 'News sentiment' })
  @ApiResponse({ status: 200 })
  getNewsSentiment(@Query() query: Record<string, string>) {
    return this.service.getNewsSentiment(query);
  }

  @Get('comments/article/:slug')
  @ApiOperation({ summary: 'Get comments for article' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200 })
  getComments(@Param('slug') slug: string) {
    return this.service.getComments(slug);
  }

  @Post('comments/article/:slug')
  @ApiOperation({ summary: 'Create comment' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 201 })
  createComment(@Param('slug') slug: string, @Body() body: CreateCommentDto) {
    return this.service.createComment(slug, body);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List categories' })
  @ApiResponse({ status: 200 })
  getCategories() {
    return this.service.getCategories();
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Get category by id' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  getCategoryById(@Param('id') id: string) {
    return this.service.getCategoryById(id);
  }

  @Get('filters')
  @ApiOperation({ summary: 'Get filters' })
  @ApiResponse({ status: 200 })
  getFilters() {
    return this.service.getFilters();
  }

  @Get('tickers')
  @ApiOperation({ summary: 'Get tickers' })
  @ApiResponse({ status: 200 })
  getTickers() {
    return this.service.getTickers();
  }

  @Get('seo')
  @ApiOperation({ summary: 'Get SEO' })
  @ApiResponse({ status: 200 })
  getSeo(@Query() query: Record<string, string>) {
    return this.service.getSeo(query);
  }

  @Put('seo')
  @ApiOperation({ summary: 'Update SEO' })
  @ApiResponse({ status: 200 })
  putSeo(@Body() body: SeoUpdateDto) {
    return this.service.putSeo(body);
  }
}
