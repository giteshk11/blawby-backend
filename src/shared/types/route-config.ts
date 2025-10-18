export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  description?: string;
}

export interface RouteConfig {
  // Default: all routes protected (true) or public (false)
  protected?: boolean;

  // List of public routes (if default is protected)
  public?: (string | RouteDefinition)[];

  // List of protected routes (if default is public)
  private?: (string | RouteDefinition)[];

  // Optional: Custom middleware per route
  middleware?: {
    [routePattern: string]: string[];
  };

  // Optional: Role-based access control
  roles?: {
    [routePattern: string]: string[];
  };
}
