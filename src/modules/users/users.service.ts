import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity.js';

const UNIQUE_VIOLATION = '23505';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  displayName: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async create(data: CreateUserData): Promise<User> {
    const email = UsersService.normalizeEmail(data.email);
    try {
      return await this.users.save(this.users.create({ ...data, email }));
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  async getById(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Includes the password hash, for credential checks only. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', {
        email: UsersService.normalizeEmail(email),
      })
      .getOne();
  }

  async updateDisplayName(id: string, displayName: string): Promise<User> {
    const user = await this.getById(id);
    user.displayName = displayName;
    return this.users.save(user);
  }
}
