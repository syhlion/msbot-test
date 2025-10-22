package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/infracloudio/msbotbuilder-go/core"
	"github.com/infracloudio/msbotbuilder-go/core/activity"
	"github.com/infracloudio/msbotbuilder-go/schema"
)

var customHandler = activity.HandlerFuncs{
	OnMessageFunc: func(turn *activity.TurnContext) (schema.Activity, error) {
		log.Printf("Processing message: %s\n", turn.Activity.Text)
		return turn.SendActivity(activity.MsgOptionText("Echo: " + turn.Activity.Text))
	},
}

// HTTPHandler handles the HTTP requests from then connector service
type HTTPHandler struct {
	core.Adapter
}

func (ht *HTTPHandler) processMessage(w http.ResponseWriter, req *http.Request) {

	ctx := context.Background()
	
	// 記錄請求標頭以便除錯
	log.Printf("Received request from: %s\n", req.RemoteAddr)
	log.Printf("Request method: %s\n", req.Method)
	log.Printf("Authorization header present: %v\n", req.Header.Get("Authorization") != "")
	
	// 處理 CORS preflight 請求
	if req.Method == "OPTIONS" {
		log.Println("OPTIONS request (CORS preflight) - responding with 200 OK")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.WriteHeader(http.StatusOK)
		return
	}
	
	activity, err := ht.Adapter.ParseRequest(ctx, req)
	if err != nil {
		log.Printf("Failed to parse request: %v\n", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// 記錄 activity 類型和 ServiceURL
	log.Printf("Activity type: %s\n", activity.Type)
	log.Printf("Service URL: %s\n", activity.ServiceURL)

	// 特別處理不需要回應的 activity type
	if activity.Type == "typing" || activity.Type == "conversationUpdate" {
		log.Printf("%s activity ignored (no response needed)\n", activity.Type)
		w.WriteHeader(http.StatusOK)
		return
	}

	err = ht.Adapter.ProcessActivity(ctx, activity, customHandler)
	if err != nil {
		log.Printf("Failed to process request: %v\n", err)
		// 即使處理失敗，也回傳 200 OK 給 Azure，避免重試
		w.WriteHeader(http.StatusOK)
		return
	}
	log.Println("Request processed successfully.")
	w.WriteHeader(http.StatusOK)
}

func main() {

	appID := os.Getenv("APP_ID")
	appPassword := os.Getenv("APP_PASSWORD")

	// 記錄環境變數狀態（不輸出完整密碼）
	if appID == "" {
		log.Println("WARNING: APP_ID is not set")
	} else {
		log.Printf("APP_ID is set: %s\n", appID)
	}
	
	if appPassword == "" {
		log.Println("WARNING: APP_PASSWORD is not set")
	} else {
		// 顯示前6個字元和長度以便驗證
		prefix := appPassword
		if len(appPassword) > 6 {
			prefix = appPassword[:6] + "..."
		}
		log.Printf("APP_PASSWORD is set: %s (length: %d)\n", prefix, len(appPassword))
	}

	setting := core.AdapterSetting{
		AppID:       appID,
		AppPassword: appPassword,
		// 設定 OpenID Metadata endpoint (使用自己的租戶)
		OpenIDMetadata: "https://login.microsoftonline.com/60ab2bb3-a010-4d54-a508-b3e73ac2aec4/v2.0/.well-known/openid-configuration",
	}

	adapter, err := core.NewBotAdapter(setting)
	if err != nil {
		log.Fatal("Error creating adapter: ", err)
	}

	httpHandler := &HTTPHandler{adapter}

	// 從環境變數讀取 Port，預設為 3978
	port := os.Getenv("PORT")
	if port == "" {
		port = "3978"
	}

	http.HandleFunc("/api/messages", httpHandler.processMessage)
	http.HandleFunc("/api/ping", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("pong"))
	})
	fmt.Printf("Starting server on port:%s...\n", port)
	http.ListenAndServe(":"+port, nil)
}