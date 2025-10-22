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
	
	activity, err := ht.Adapter.ParseRequest(ctx, req)
	if err != nil {
		log.Printf("Failed to parse request: %v\n", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err = ht.Adapter.ProcessActivity(ctx, activity, customHandler)
	if err != nil {
		log.Printf("Failed to process request: %v\n", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	log.Println("Request processed successfully.")
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
		log.Println("APP_PASSWORD is set (hidden)")
	}

	setting := core.AdapterSetting{
		AppID:       appID,
		AppPassword: appPassword,
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