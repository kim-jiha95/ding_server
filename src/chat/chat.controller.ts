import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { DataService } from '../data/data.service';
import { AppendMessageDto, SaveThreadDto } from './dto';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly dataService: DataService) {}

  @Get('threads')
  async threads(@Req() req: { userId: string }) {
    return this.dataService.threads(req.userId);
  }

  @Get('threads/page')
  async threadPage(@Req() req: { userId: string }, @Query() query: PaginationQueryDto) {
    return this.dataService.threadPage(req.userId, query.page, query.pageSize);
  }

  @Get('threads/:id/messages/page')
  async threadMessagesPage(
    @Req() req: { userId: string },
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.dataService.threadMessagesPage(req.userId, id, query.page, query.pageSize);
  }

  @Put('threads/:id')
  async saveThread(
    @Req() req: { userId: string },
    @Param('id') id: string,
    @Body() body: SaveThreadDto,
  ) {
    return this.dataService.saveThread(req.userId, id, body.messages ?? [], body.preview ?? '');
  }

  @Post('threads/:id/messages')
  async appendMessage(
    @Req() req: { userId: string },
    @Param('id') id: string,
    @Body() body: AppendMessageDto,
  ) {
    return this.dataService.appendThreadMessage(req.userId, id, body);
  }

  @Patch('threads/:id/read')
  async markRead(@Req() req: { userId: string }, @Param('id') id: string) {
    return this.dataService.markThreadRead(req.userId, id);
  }
}
