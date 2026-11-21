package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"
)

// ErrNotFound is returned when a user does not exist.
var ErrNotFound = errors.New("user not found")

type User struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Store interface {
	Get(id int64) (*User, error)
}

type Handler struct {
	store   Store
	timeout time.Duration
}

func NewHandler(store Store) *Handler {
	return &Handler{store: store, timeout: 5 * time.Second}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	user, err := h.store.Get(id)
	switch {
	case errors.Is(err, ErrNotFound):
		http.NotFound(w, r)
	case err != nil:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	default:
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(user)
	}
}

func retry(attempts int, fn func() error) (err error) {
	for i := 0; i < attempts; i++ {
		if err = fn(); err == nil {
			return nil
		}
		time.Sleep(time.Duration(1<<i) * 100 * time.Millisecond)
	}
	return err
}
