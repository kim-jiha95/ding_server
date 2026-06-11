import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  id!: string;

  @IsString()
  senderID!: string;

  @IsString()
  body!: string;

  @IsString()
  timestamp!: string;
}

export class SaveThreadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @IsString()
  preview!: string;
}

export class AppendMessageDto {
  @IsString()
  senderID!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  timestamp?: string;
}
