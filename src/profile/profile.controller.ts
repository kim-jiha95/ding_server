import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DataService } from '../data/data.service';
import { RegisterDeviceTokenDto, UpdateProfileDto } from './dto';

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly dataService: DataService) {}

  @Get('me')
  me(@Req() req: { userId: string }) {
    return this.dataService.profile(req.userId);
  }

  @Patch('me')
  update(@Req() req: { userId: string }, @Body() dto: UpdateProfileDto) {
    return this.dataService.updateProfile(req.userId, dto.name, dto.bio);
  }

  @Post('me/device-tokens')
  registerDeviceToken(@Req() req: { userId: string }, @Body() dto: RegisterDeviceTokenDto) {
    return this.dataService.registerDeviceToken(req.userId, dto.token, dto.platform, dto.environment ?? 'sandbox');
  }
}
