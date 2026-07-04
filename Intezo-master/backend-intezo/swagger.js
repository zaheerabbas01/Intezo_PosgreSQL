import swaggerUi from 'swagger-ui-express';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || process.env.PUBLIC_BASE_URL || DEFAULT_BASE_URL;

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Intezo Backend API',
    version: '1.0.0',
    description: 'OpenAPI documentation for the Intezo backend services, including authentication, clinic, doctor, patient, queue, premium, reporting, and admin endpoints.'
  },
  servers: [
    {
      url: `${API_BASE_URL}/api`
    }
  ],
  tags: [
    { name: 'Auth', description: 'Authentication and verification endpoints for patients, clinics, doctors, and admins.' },
    { name: 'Clinics', description: 'Clinic discovery, profile, analytics, and queue-related management endpoints.' },
    { name: 'Doctors', description: 'Doctor profile, availability, and queue management endpoints.' },
    { name: 'Patients', description: 'Patient registration, profile, queue, notifications, and booking endpoints.' },
    { name: 'Queues', description: 'Public and protected queue booking and management endpoints.' },
    { name: 'Premium', description: 'Premium payment submission and status endpoints.' },
    { name: 'Reports', description: 'Report creation, retrieval, PDF download, and template endpoints.' },
    { name: 'Admin', description: 'Administrative dashboard, user management, and moderation endpoints.' },
    { name: 'System', description: 'Health checks, test endpoints, and miscellaneous system helpers.' }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'string' }
        }
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: { type: 'object', additionalProperties: true }
        }
      },
      QueueResponse: {
        type: 'object',
        additionalProperties: true
      },
      ReportResponse: {
        type: 'object',
        additionalProperties: true
      },
      User: {
        type: 'object',
        additionalProperties: true
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Unauthorized or invalid token',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      },
      BadRequestError: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      }
    }
  },
  paths: {
    '/auth/register/patient': {
      post: {
        tags: ['Auth'],
        summary: 'Start passwordless patient registration',
        description: 'Start WhatsApp verification using only the patient name and Pakistani mobile number.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone'],
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string', example: '03342407631' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'WhatsApp registration challenge created' },
          400: { $ref: '#/components/responses/BadRequestError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/auth/login/patient': {
      post: {
        tags: ['Auth'],
        summary: 'Start passwordless patient login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone'],
                properties: {
                  phone: { type: 'string', example: '03342407631' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'WhatsApp login challenge created'
          },
          400: { $ref: '#/components/responses/BadRequestError' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/auth/register/clinic': {
      post: {
        tags: ['Auth'],
        summary: 'Register a clinic',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        responses: {
          200: { description: 'Clinic registration initiated successfully' },
          400: { $ref: '#/components/responses/BadRequestError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/auth/login/clinic': {
      post: {
        tags: ['Auth'],
        summary: 'Login a clinic',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Clinic authenticated',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthResponse'
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequestError' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/auth/register/doctor': {
      post: {
        tags: ['Auth'],
        summary: 'Register a doctor',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        responses: {
          200: { description: 'Doctor registration initiated successfully' },
          400: { $ref: '#/components/responses/BadRequestError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/auth/login/doctor': {
      post: {
        tags: ['Auth'],
        summary: 'Login a doctor',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Doctor authenticated',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthResponse'
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequestError' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/auth/admin/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login an admin',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Admin authenticated',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthResponse'
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequestError' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout current user',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Logout successful' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/public': {
      get: {
        tags: ['Clinics'],
        summary: 'List public clinics',
        responses: {
          200: { description: 'Public clinic list returned' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/recent': {
      post: {
        tags: ['Clinics'],
        summary: 'Get recent clinics',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        responses: {
          200: { description: 'Recent clinics returned' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/{clinicId}/complete': {
      get: {
        tags: ['Clinics'],
        summary: 'Get complete clinic details',
        parameters: [{ name: 'clinicId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Clinic details returned' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/{clinicId}/summary': {
      get: {
        tags: ['Clinics'],
        summary: 'Get clinic summary',
        parameters: [{ name: 'clinicId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Clinic summary returned' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/{clinicId}/status': {
      get: {
        tags: ['Clinics'],
        summary: 'Get clinic open status',
        parameters: [{ name: 'clinicId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Clinic status returned' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/status': {
      get: {
        tags: ['Clinics'],
        summary: 'Get authenticated clinic status',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Authenticated clinic status returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/profile': {
      get: {
        tags: ['Clinics'],
        summary: 'Get authenticated clinic profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Clinic profile returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      put: {
        tags: ['Clinics'],
        summary: 'Update authenticated clinic profile',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        responses: {
          200: { description: 'Clinic profile updated' },
          400: { $ref: '#/components/responses/BadRequestError' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      delete: {
        tags: ['Clinics'],
        summary: 'Delete authenticated clinic profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Clinic profile deleted' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/analytics': {
      get: {
        tags: ['Clinics'],
        summary: 'Get clinic analytics',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Analytics returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/toggle-status': {
      post: {
        tags: ['Clinics'],
        summary: 'Toggle clinic open state',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Clinic status toggled' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/reset-all-queues': {
      post: {
        tags: ['Clinics'],
        summary: 'Reset all clinic queues',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Queues reset' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/verify-redis-counters': {
      post: {
        tags: ['Clinics'],
        summary: 'Verify Redis queue counters',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Redis counters verified' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/check-operation-hours': {
      post: {
        tags: ['Clinics'],
        summary: 'Check clinic operation hours',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Operation hours checked' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/debug-queue': {
      get: {
        tags: ['Clinics'],
        summary: 'Debug clinic queue state',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Queue debug info returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/upload-photo': {
      post: {
        tags: ['Clinics'],
        summary: 'Upload clinic profile photo',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  profilePhoto: { type: 'string', format: 'binary' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Photo uploaded' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/delete-photo': {
      delete: {
        tags: ['Clinics'],
        summary: 'Delete clinic profile photo',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Photo deleted' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/add-patient-to-queue': {
      post: {
        tags: ['Clinics'],
        summary: 'Add patient to clinic queue',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        responses: {
          200: { description: 'Patient added to queue' },
          400: { $ref: '#/components/responses/BadRequestError' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/clinics/patients/{patientId}/history': {
      get: {
        tags: ['Clinics'],
        summary: 'Get patient history for clinic',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Patient history returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/public/{clinicId}': {
      get: {
        tags: ['Doctors'],
        summary: 'Get public doctors for a clinic',
        parameters: [{ name: 'clinicId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Doctors returned' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors': {
      get: {
        tags: ['Doctors'],
        summary: 'List doctors for authenticated clinic',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Doctors returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      post: {
        tags: ['Doctors'],
        summary: 'Add a doctor to the authenticated clinic',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        responses: {
          200: { description: 'Doctor created' },
          400: { $ref: '#/components/responses/BadRequestError' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/available': {
      get: {
        tags: ['Doctors'],
        summary: 'List available doctors',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Available doctors returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/add-to-clinic': {
      post: {
        tags: ['Doctors'],
        summary: 'Add doctor to clinic',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Doctor added to clinic' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/profile': {
      get: {
        tags: ['Doctors'],
        summary: 'Get authenticated doctor profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Doctor profile returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      put: {
        tags: ['Doctors'],
        summary: 'Update authenticated doctor profile',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Doctor profile updated' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/stats': {
      get: {
        tags: ['Doctors'],
        summary: 'Get authenticated doctor statistics',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Doctor statistics returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/upload-photo': {
      post: {
        tags: ['Doctors'],
        summary: 'Upload doctor profile photo',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  profilePhoto: { type: 'string', format: 'binary' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Photo uploaded' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/delete-photo': {
      delete: {
        tags: ['Doctors'],
        summary: 'Delete doctor profile photo',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Photo deleted' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/toggle-availability': {
      post: {
        tags: ['Doctors'],
        summary: 'Toggle doctor availability',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Doctor availability updated' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/{id}/queue-status': {
      get: {
        tags: ['Doctors'],
        summary: 'Get doctor queue status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Queue status returned' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/queue/skip': {
      post: {
        tags: ['Doctors'],
        summary: 'Skip current patient',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Patient skipped' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/queue/skipped/{doctorId}': {
      get: {
        tags: ['Doctors'],
        summary: 'Get skipped patients',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'doctorId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Skipped patients returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/queue/call-back/{queueId}': {
      post: {
        tags: ['Doctors'],
        summary: 'Call back skipped patient',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'queueId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Patient called back' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/doctors/queue/next': {
      post: {
        tags: ['Doctors'],
        summary: 'Advance the current number',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Current number updated' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/register': {
      post: {
        tags: ['Patients'],
        summary: 'Register a patient and add to queue (optional)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Patient registration completed' },
          400: { $ref: '#/components/responses/BadRequestError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/register-and-queue': {
      post: {
        tags: ['Patients'],
        summary: 'Register patient and add to queue',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Patient created and queued' },
          400: { $ref: '#/components/responses/BadRequestError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/fcm-token': {
      post: {
        tags: ['Patients'],
        summary: 'Update patient FCM token',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'FCM token updated' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      put: {
        tags: ['Patients'],
        summary: 'Update patient FCM token',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'FCM token updated' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/book-doctor': {
      post: {
        tags: ['Patients'],
        summary: 'Book a doctor appointment',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Appointment booked' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/{patientId}': {
      put: {
        tags: ['Patients'],
        summary: 'Update patient information',
        parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Patient information updated' },
          400: { $ref: '#/components/responses/BadRequestError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/{patientId}/history': {
      get: {
        tags: ['Patients'],
        summary: 'Get patient queue history',
        parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Patient history returned' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/profile': {
      get: {
        tags: ['Patients'],
        summary: 'Get authenticated patient profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Patient profile returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/queue-status': {
      get: {
        tags: ['Patients'],
        summary: 'Get authenticated patient queue status',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Queue status returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/cancel-booking': {
      delete: {
        tags: ['Patients'],
        summary: 'Cancel authenticated patient booking',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Booking cancelled' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/notifications/preferences': {
      get: {
        tags: ['Patients'],
        summary: 'Get patient notification preferences',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Notification preferences returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/notifications/clinic/{clinicId}': {
      post: {
        tags: ['Patients'],
        summary: 'Enable clinic notifications',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'clinicId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Clinic notifications enabled' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      delete: {
        tags: ['Patients'],
        summary: 'Disable clinic notifications',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'clinicId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Clinic notifications disabled' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/patients/notifications/doctor/{doctorId}': {
      post: {
        tags: ['Patients'],
        summary: 'Enable doctor notifications',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'doctorId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Doctor notifications enabled' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      delete: {
        tags: ['Patients'],
        summary: 'Disable doctor notifications',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'doctorId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Doctor notifications disabled' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/public/{clinicId}/{doctorId}': {
      get: {
        tags: ['Queues'],
        summary: 'Get public queue data',
        parameters: [
          { name: 'clinicId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'doctorId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Public queue data returned' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/book': {
      post: {
        tags: ['Queues'],
        summary: 'Book a queue number',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Queue number booked' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/cancel/{queueId}': {
      post: {
        tags: ['Queues'],
        summary: 'Cancel a queue booking (clinic admin)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'queueId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Queue booking cancelled' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      delete: {
        tags: ['Queues'],
        summary: 'Cancel a queue booking (patient)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'queueId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Queue booking cancelled' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/book-doctor': {
      post: {
        tags: ['Queues'],
        summary: 'Book a doctor queue slot',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Doctor queue slot booked' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/next': {
      post: {
        tags: ['Queues'],
        summary: 'Advance queue to the next patient',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Current number updated' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/skip': {
      post: {
        tags: ['Queues'],
        summary: 'Skip the current patient',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Patient skipped' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/skipped/{doctorId}': {
      get: {
        tags: ['Queues'],
        summary: 'Get skipped patients for a doctor',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'doctorId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Skipped patients returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/call-back/{queueId}': {
      post: {
        tags: ['Queues'],
        summary: 'Call back a skipped patient',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'queueId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Patient called back' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/patient/{queueId}/wait-time': {
      get: {
        tags: ['Queues'],
        summary: 'Get patient wait time',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'queueId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Patient wait time returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/{clinicId}/{doctorId}/wait-time': {
      get: {
        tags: ['Queues'],
        summary: 'Get estimated wait time for a clinic and doctor',
        parameters: [
          { name: 'clinicId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'doctorId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Wait time returned' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/{clinicId}/{doctorId}/detailed': {
      get: {
        tags: ['Queues'],
        summary: 'Get detailed queue and wait time info',
        parameters: [
          { name: 'clinicId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'doctorId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Detailed queue information returned' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/queues/next-doctor': {
      post: {
        tags: ['Queues'],
        summary: 'Advance a doctor-specific queue',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Doctor queue advanced' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/premium/submit-payment': {
      post: {
        tags: ['Premium'],
        summary: 'Submit premium payment',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Premium payment submitted' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/premium/status': {
      get: {
        tags: ['Premium'],
        summary: 'Get premium status',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Premium status returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/reports/custom-templates': {
      get: {
        tags: ['Reports'],
        summary: 'Get custom report templates',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Templates returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      post: {
        tags: ['Reports'],
        summary: 'Save custom report templates',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Templates saved' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/reports/options': {
      get: {
        tags: ['Reports'],
        summary: 'Get report options',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Report options returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/reports/patient': {
      get: {
        tags: ['Reports'],
        summary: 'Get reports for the authenticated patient',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Patient reports returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/reports/clinic': {
      get: {
        tags: ['Reports'],
        summary: 'Get reports for clinic or doctor',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Clinic reports returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/reports': {
      post: {
        tags: ['Reports'],
        summary: 'Create a report',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Report created' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/reports/{reportId}/download': {
      get: {
        tags: ['Reports'],
        summary: 'Download a report as PDF',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'reportId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'PDF report returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/reports/{reportId}/read': {
      patch: {
        tags: ['Reports'],
        summary: 'Mark a report as read',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'reportId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Report marked as read' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/stats': {
      get: {
        tags: ['Admin'],
        summary: 'Get admin dashboard stats',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Admin dashboard stats returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/patients': {
      get: {
        tags: ['Admin'],
        summary: 'List all patients',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Patients returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/doctors': {
      get: {
        tags: ['Admin'],
        summary: 'List all doctors',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Doctors returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/clinics': {
      get: {
        tags: ['Admin'],
        summary: 'List all clinics',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Clinics returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/patients/{id}': {
      delete: {
        tags: ['Admin'],
        summary: 'Delete a patient',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Patient deleted' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      put: {
        tags: ['Admin'],
        summary: 'Update a patient',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: {
          200: { description: 'Patient updated' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/doctors/{id}': {
      delete: {
        tags: ['Admin'],
        summary: 'Delete a doctor',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Doctor deleted' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      put: {
        tags: ['Admin'],
        summary: 'Update a doctor',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: {
          200: { description: 'Doctor updated' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/clinics/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Update a clinic',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        responses: {
          200: { description: 'Clinic updated' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete a clinic',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Clinic deleted' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/pending-approvals': {
      get: {
        tags: ['Admin'],
        summary: 'Get pending approvals',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Pending approvals returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/approve/{id}': {
      post: {
        tags: ['Admin'],
        summary: 'Approve a registration',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Registration approved' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/reject/{id}': {
      post: {
        tags: ['Admin'],
        summary: 'Reject a registration',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Registration rejected' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/activity': {
      get: {
        tags: ['Admin'],
        summary: 'Get system activity feed',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'System activity returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/broadcast': {
      post: {
        tags: ['Admin'],
        summary: 'Broadcast an admin update',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          200: { description: 'Broadcast sent' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/online-users': {
      get: {
        tags: ['Admin'],
        summary: 'Get online users',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Online users returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/logout': {
      post: {
        tags: ['Admin'],
        summary: 'Logout admin session',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Admin logout successful' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/premium-payments': {
      get: {
        tags: ['Admin'],
        summary: 'Get pending premium payments',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Premium payments returned' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/auth/patient/phone/status': {
      post: {
        tags: ['Auth'],
        summary: 'Complete passwordless patient authentication',
        description: 'Poll with the private challenge credentials until WhatsApp verifies the phone number.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['requestId', 'pollToken'],
                properties: {
                  requestId: { type: 'string', format: 'uuid' },
                  pollToken: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Challenge pending or patient authenticated' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/premium-users': {
      get: {
        tags: ['Admin'],
        summary: 'Get all premium users',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Premium users returned with active and expired subscription status' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/premium-payments/{id}/approve': {
      post: {
        tags: ['Admin'],
        summary: 'Approve a premium payment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Premium payment approved' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/admin/premium-payments/{id}/reject': {
      post: {
        tags: ['Admin'],
        summary: 'Reject a premium payment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Premium payment rejected' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
          404: { $ref: '#/components/responses/NotFoundError' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/sitemap.xml': {
      get: {
        tags: ['System'],
        summary: 'Get sitemap XML',
        responses: {
          200: { description: 'Sitemap returned' },
          500: { $ref: '#/components/responses/InternalServerError' }
        }
      }
    }
  }
};

export const swaggerUiMiddleware = swaggerUi.serve;
export const swaggerUiSetup = swaggerUi.setup;
