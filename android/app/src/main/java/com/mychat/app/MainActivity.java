package com.mychat.app;

import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.annotation.Nullable;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Override WebViewClient to handle Jitsi Meet app scheme and other external intents
        bridge.getWebView().setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                String urlString = url.toString();
                
                // Handle Jitsi Meet app schemes
                if ("org.jitsi.meet".equals(scheme) || "jitsi-meet".equals(scheme)) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, url);
                        intent.setPackage("org.jitsi.meet"); // Ensure Jitsi Meet app is prioritized
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        // Fallback: If app not installed, let WebView handle it
                        return super.shouldOverrideUrlLoading(view, request);
                    }
                }
                
                // Handle intent:// schemes (often used by "Join in app" buttons)
                if ("intent".equals(scheme)) {
                    try {
                        Intent intent = Intent.parseUri(urlString, Intent.URI_INTENT_SCHEME);
                        if (intent != null) {
                            String packageName = intent.getPackage();
                            if ("org.jitsi.meet".equals(packageName)) {
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                                return true;
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
                
                // Let other URLs load normally in WebView
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}
