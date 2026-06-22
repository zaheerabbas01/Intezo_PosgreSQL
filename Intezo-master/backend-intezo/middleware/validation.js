import { body } from 'express-validator';

export const validatePhone = [
  body('phone')
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),
];