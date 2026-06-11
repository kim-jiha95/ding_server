import { Body, Controller, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto, UpdatePreferenceDto } from './dto';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(200)
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(AuthGuard)
  @Get('bootstrap')
  async bootstrap(@Req() req: { userId: string }) {
    return this.authService.bootstrap(req.userId);
  }

  @UseGuards(AuthGuard)
  @Patch('preference')
  async preference(@Req() req: { userId: string }, @Body() body: UpdatePreferenceDto) {
    return this.authService.updatePreference(req.userId, body.preference);
  }
}
