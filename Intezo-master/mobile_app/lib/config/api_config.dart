class ApiConfig {
  // Cloudflare tunnel URL
  static const String baseUrl = 'https://api.intezo.online/api';
  
  // For local development (when on same network)
  static const String localUrl = 'http://192.168.100.69:3000/api';
  
  // Use this to switch between local and cloudflare
  static const bool useCloudflare = true; // Using Cloudflare tunnel
  
  static String get currentBaseUrl {
    final url = useCloudflare ? baseUrl : localUrl;
    print('ApiConfig: Using base URL: $url');
    return url;
  }
}
