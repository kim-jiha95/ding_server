import { IsEmail, IsIn, IsNotEmpty, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email!: string;

  @MinLength(4)
  password!: string;

  @IsNotEmpty()
  username!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @MinLength(4)
  password!: string;
}

export class UpdatePreferenceDto {
  @IsIn(['Women', 'Men', 'Everyone'])
  preference!: 'Women' | 'Men' | 'Everyone';
}
