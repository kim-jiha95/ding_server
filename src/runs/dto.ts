import { Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

function parseRouteTimestamp(value: unknown): Date {
  if (value instanceof Date) return value;

  const parseNumericTimestamp = (numeric: number) => {
    if (numeric > 10_000_000_000) {
      return new Date(numeric);
    }

    // Swift Date JSON can arrive as seconds since Apple's 2001 reference date.
    if (numeric > 0 && numeric < 978_307_200) {
      return new Date(Date.UTC(2001, 0, 1, 0, 0, 0) + numeric * 1000);
    }

    return new Date(numeric * 1000);
  };

  if (typeof value === 'number') {
    return parseNumericTimestamp(value);
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && value.trim() !== '') {
      return parseNumericTimestamp(numeric);
    }
    return new Date(value);
  }
  return new Date(NaN);
}

export class RunRoutePointDto {
  @IsString()
  id!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @Transform(({ value }) => parseRouteTimestamp(value))
  @IsDate()
  timestamp!: Date;
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
