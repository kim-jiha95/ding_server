import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataService } from '../data/data.service';
import { LoginDto, SignupDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataService: DataService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    try {
      const session = await this.dataService.signup(dto.email, dto.password, dto.username);
      const signed = { ...session, accessToken: this.jwtService.sign({ sub: session.userID }) };
      return { session: signed, profile: await this.dataService.profile(session.userID) };
    } catch {
      throw new BadRequestException('Email already exists');
    }
  }

  async login(dto: LoginDto) {
    const session = await this.dataService.login(dto.email, dto.password);
    const signed = { ...session, accessToken: this.jwtService.sign({ sub: session.userID }) };
    return { session: signed, profile: await this.dataService.profile(session.userID) };
  }

  async bootstrap(userId: string) {
    const result = await this.dataService.bootstrap(userId);
    return {
      session: { ...result.session, accessToken: this.jwtService.sign({ sub: result.session.userID }) },
      profile: result.profile,
    };
  }

  async updatePreference(userId: string, preference: 'Women' | 'Men' | 'Everyone') {
    const session = await this.dataService.updatePreference(userId, preference);
    return { ...session, accessToken: this.jwtService.sign({ sub: session.userID }) };
  }
}
