import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DataService } from '../data/data.service';

@Controller('ding')
@UseGuards(AuthGuard)
export class DingController {
  constructor(private readonly dataService: DataService) {}

  @Get('summary')
  summary(@Req() req: { userId: string }) {
    return this.dataService.dingSummary(req.userId);
  }

  @Post('send')
  send(@Req() req: { userId: string }, @Body() body: { encounterIDs: string[] }) {
    return this.dataService.sendDing(req.userId, body.encounterIDs ?? []);
  }
}
