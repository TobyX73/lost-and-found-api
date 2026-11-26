import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  findAll(): Promise<Category[]> {
    return this.categories.find({ order: { id: 'ASC' } });
  }

  /** Throws 400 (not 404) because an unknown category is a bad value in the request body. */
  async assertExists(id: number): Promise<void> {
    if (!(await this.categories.existsBy({ id }))) {
      throw new BadRequestException(`categoryId: category ${id} does not exist`);
    }
  }
}
