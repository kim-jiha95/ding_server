import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { DataService } from '../data/data.service';
import { FinishRunDto } from './dto';

@Controller('runs')
@UseGuards(AuthGuard)
export class RunsController {
  constructor(private readonly dataService: DataService) {}

  @Get('dashboard')
  async dashboard(@Req() req: { userId: string }) {
    return this.dataService.dashboard(req.userId);
  }

  @Get('activity')
  async activity(@Req() req: { userId: string }) {
    return this.dataService.activity(req.userId);
  }

  @Get('activity/page')
  async activityPage(@Req() req: { userId: string }, @Query() query: PaginationQueryDto) {
    return this.dataService.activityPage(req.userId, query.page, query.pageSize);
  }

  @Post('finish')
  async finish(@Req() req: { userId: string }, @Body() run: FinishRunDto) {
    return this.dataService.finishRun(req.userId, run);
  }
}
