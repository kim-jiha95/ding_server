import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class RunRoutePointDto {
  @IsString()
  id!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}

export class LiveRunSplitDto {
  @IsString()
  id!: string;

  @IsNumber()
  @Min(1)
  kilometer!: number;

  @IsString()
  splitTime!: string;

  @IsString()
  paceText!: string;
}

export class FinishRunDto {
  @IsString()
  id!: string;

  @IsNumber()
  @Min(0)
  distanceKM!: number;

  @IsString()
  duration!: string;

  @IsString()
  averagePace!: string;

  @IsNumber()
  @Min(0)
  calories!: number;

  @IsString()
  dateLabel!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RunRoutePointDto)
  route!: RunRoutePointDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LiveRunSplitDto)
  splits!: LiveRunSplitDto[];
}
