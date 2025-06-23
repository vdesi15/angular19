// transaction-details.strategy.ts
import { Injectable, inject } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from 'src/app/core/services/config.service';
import { 
  TransactionDetailsRequest, 
  TransactionDetailsResponse,
  TransactionHit,
  TransactionTimelineItem
} from '../models/transaction-details.model';

@Injectable({ providedIn: 'root' })
export class TransactionDetailsStrategy {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  public buildDisplayTitle(transactionId: string): string {
    return `Transaction Details: ${transactionId.substring(0, 12)}...`;
  }

  public execute(request: TransactionDetailsRequest): Observable<TransactionDetailsResponse> {
    const useMocks = this.configService.get('useMocks');

    if (useMocks) {
      return this.createMockData(request);
    }

    // Real API call - baseapi/gettxndetails/app/env/location/id
    const baseApi = this.configService.get('api.baseUrl');
    const url = `${baseApi}/gettxndetails/${request.appName}/${request.environment}/${request.location}/${request.transactionId}`;

    return this.http.get<TransactionDetailsResponse>(url);
  }

  private createMockData(request: TransactionDetailsRequest): Observable<TransactionDetailsResponse> {
    // Generate realistic mock data based on your response structure
    const mockHits: TransactionHit[] = [
      {
        _index: 'logs-2024-01',
        _id: 'doc-001',
        _source: {
          'request.type': 'http',
          '@timestamp': '2024-01-15T10:00:00.000Z',
          'transaction.id': request.transactionId,
          'service.name': 'user-service',
          'http.method': 'GET',
          'http.url': '/api/users',
          'http.status_code': 200,
          'response.time': 150,
          'message': 'User request processed successfully'
        }
      },
      {
        _index: 'logs-2024-01',
        _id: 'doc-002',
        _source: {
          'request.type': 'database',
          '@timestamp': '2024-01-15T10:00:00.020Z',
          'transaction.id': request.transactionId,
          'service.name': 'postgres-db',
          'db.statement': 'SELECT * FROM users WHERE id = $1',
          'db.duration': 60,
          'message': 'Database query executed'
        }
      },
      {
        _index: 'logs-2024-01',
        _id: 'doc-003',
        _source: {
          'request.type': 'http',
          '@timestamp': '2024-01-15T10:00:00.090Z',
          'transaction.id': request.transactionId,
          'service.name': 'profile-service',
          'http.method': 'GET',
          'http.url': '/api/profile',
          'http.status_code': 200,
          'response.time': 50,
          'message': 'Profile data retrieved'
        }
      }
    ];

    const mockTimeline: TransactionTimelineItem[] = [
      {
        action: 'Request Started',
        id: 'timeline-001',
        time: '2024-01-15T10:00:00.000Z',
        e: 'HTTP request initiated',
        l: 'user-transaction-flow',
        current: true
      },
      {
        action: 'Database Query',
        id: 'timeline-002',
        time: '2024-01-15T10:00:00.020Z',
        e: 'User data lookup',
        l: 'user-transaction-flow'
      },
      {
        action: 'Profile Service Call',
        id: 'timeline-003',
        time: '2024-01-15T10:00:00.090Z',
        e: 'Profile information retrieved',
        l: 'user-transaction-flow'
      },
      {
        action: 'Request Completed',
        id: 'timeline-004',
        time: '2024-01-15T10:00:00.150Z',
        e: 'Response sent to client',
        l: 'user-transaction-flow'
      }
    ];

    const mockResponse: TransactionDetailsResponse = {
      hits: {
        total: 3,
        hits: mockHits
      },
      overflow: false,
      call_count: 1,
      FORMATTED_PAYLOADS: [],
      TRANSACTION_TIMELINE: mockTimeline
    };

    // Simulate API delay
    return of(mockResponse).pipe(delay(1000));
  }
}