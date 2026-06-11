import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateProfileDto {
  @IsNotEmpty()
  name!: string;

  @IsNotEmpty()
  bio!: string;
}

export class RegisterDeviceTokenDto {
  @IsNotEmpty()
  token!: string;

  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';
}
